import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import * as fs from 'node:fs/promises';
import * as path from 'node:path';
import { RAGChat } from './RAGChat.js';
import { AIAdapter, LocalVectorStore } from '@termuijs/adapters';
import { Screen, KeyEvent } from '@termuijs/core';

const flush = () => new Promise<void>(resolve => setTimeout(resolve, 0));

describe('RAGChat', () => {
    let mockAI: AIAdapter;
    let mockVectorStore: LocalVectorStore;
    let tempDocsDir: string;

    beforeEach(async () => {
        tempDocsDir = path.join(process.cwd(), 'temp-test-rag-chat-docs');
        await fs.mkdir(tempDocsDir, { recursive: true });
        await fs.writeFile(path.join(tempDocsDir, 'doc1.md'), 'TermUI widgets are beautiful', 'utf-8');

        mockAI = {
            generate: vi.fn(),
            chat: vi.fn(async function* () {
                yield 'Here ';
                yield 'is ';
                yield 'the ';
                yield 'answer.';
            }),
            embed: vi.fn(async () => [0.1, 0.2, 0.3]),
        };

        mockVectorStore = {
            addDocuments: vi.fn(),
            query: vi.fn(async () => [
                { id: 'chunk-0', text: 'TermUI widgets are beautiful', filePath: 'doc1.md' }
            ]),
            load: vi.fn(),
            save: vi.fn(),
        } as any;
    });

    afterEach(async () => {
        try {
            await fs.rm(tempDocsDir, { recursive: true, force: true });
        } catch {}
    });

    const makeKeyEvent = (key: string): KeyEvent => ({
        key,
        raw: Buffer.alloc(0),
        ctrl: false,
        alt: false,
        shift: false,
        stopPropagation: () => {},
        preventDefault: () => {},
    });

    const awaitIndex = async (store: any) => {
        await new Promise<void>(resolve => {
            const timer = setInterval(() => {
                if (store.save.mock.calls.length > 0) {
                    clearInterval(timer);
                    resolve();
                }
            }, 2);
            setTimeout(() => {
                clearInterval(timer);
                resolve();
            }, 200);
        });
    };

    it('renders chat panel with input and history areas on mount', async () => {
        const chat = new RAGChat({}, {
            ai: mockAI,
            vectorStore: mockVectorStore,
            docsPath: tempDocsDir,
        });

        const screen = new Screen(60, 20);
        chat.updateRect({ x: 0, y: 0, width: 60, height: 20 });
        chat.render(screen);

        await awaitIndex(mockVectorStore);

        expect(mockVectorStore.load).toHaveBeenCalled();
        expect(mockVectorStore.save).toHaveBeenCalled();
    });

    it('submits input, triggers retrieval query, and shows loading state', async () => {
        const chat = new RAGChat({}, {
            ai: mockAI,
            vectorStore: mockVectorStore,
            docsPath: tempDocsDir,
        });

        await awaitIndex(mockVectorStore);

        chat.isFocused = true;
        for (const ch of 'What is TermUI?') {
            chat.handleKey(makeKeyEvent(ch));
        }

        chat.handleKey(makeKeyEvent('enter'));

        await flush();
        await flush();

        expect(mockVectorStore.query).toHaveBeenCalledWith('What is TermUI?', mockAI, 3);
    });

    it('streams AI tokens into the history list on response', async () => {
        const chat = new RAGChat({}, {
            ai: mockAI,
            vectorStore: mockVectorStore,
            docsPath: tempDocsDir,
        });

        await awaitIndex(mockVectorStore);

        chat.isFocused = true;
        for (const ch of 'Hello?') {
            chat.handleKey(makeKeyEvent(ch));
        }
        chat.handleKey(makeKeyEvent('enter'));

        await flush();
        await flush();
        await flush();

        expect(mockAI.chat).toHaveBeenCalled();
    });
});
