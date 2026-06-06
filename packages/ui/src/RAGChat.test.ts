import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import * as fsPromises from 'node:fs/promises';
import * as path from 'node:path';
import { RAGChat } from './RAGChat.js';
import { Screen, KeyEvent } from '@termuijs/core';

const flush = () => new Promise<void>(resolve => setTimeout(resolve, 0));

describe('RAGChat', () => {
    let mockAI: any;
    let mockVectorStore: any;
    let tempDocsDir: string;
    let mockIndexFn: any;

    beforeEach(async () => {
        tempDocsDir = path.join(process.cwd(), 'temp-test-rag-chat-docs');
        await fsPromises.mkdir(tempDocsDir, { recursive: true });
        await fsPromises.writeFile(path.join(tempDocsDir, 'doc1.md'), 'TermUI widgets are beautiful', 'utf-8');

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
        };

        mockIndexFn = vi.fn();
    });

    afterEach(async () => {
        try {
            await fsPromises.rm(tempDocsDir, { recursive: true, force: true });
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

    const awaitIndex = async (store: any) => { // Cast needed: store is a test double; only `save` mock call count is used here.
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
            indexFn: mockIndexFn,
        });

        const screen = new Screen(60, 20);
        chat.updateRect({ x: 0, y: 0, width: 60, height: 20 });
        chat.render(screen);

        await awaitIndex(mockVectorStore);

        expect(mockVectorStore.load).toHaveBeenCalled();
        expect(mockVectorStore.save).toHaveBeenCalled();
        expect(mockIndexFn).toHaveBeenCalled();

        // Assert rendered output from the screen to verify visible UI elements
        const rendered = screen.back.map(row => row.map(c => c.char).join('')).join('\n');
        expect(rendered).toContain('Ask a question against docs...');
    });

    it('submits input, triggers retrieval query, and shows loading state', async () => {
        const chat = new RAGChat({}, {
            ai: mockAI,
            vectorStore: mockVectorStore,
            docsPath: tempDocsDir,
            indexFn: mockIndexFn,
        });

        await awaitIndex(mockVectorStore);

        chat.isFocused = true;
        for (const ch of 'What is TermUI?') {
            chat.handleKey(makeKeyEvent(ch));
        }

        // Verify the input is rendered in the input field before submission
        const screenBefore = new Screen(60, 20);
        chat.updateRect({ x: 0, y: 0, width: 60, height: 20 });
        chat.render(screenBefore);
        const renderedBefore = screenBefore.back.map(row => row.map(c => c.char).join('')).join('\n');
        expect(renderedBefore).toContain('What is TermUI?');

        chat.handleKey(makeKeyEvent('enter'));

        await flush();
        await flush();

        expect(mockVectorStore.query).toHaveBeenCalledWith('What is TermUI?', mockAI, 3);
        
        // After enter, input is submitted, query input should be cleared
        chat.isFocused = false;
        const screenAfter = new Screen(60, 20);
        chat.render(screenAfter);
        const renderedAfter = screenAfter.back.map(row => row.map(c => c.char).join('')).join('\n');
        expect(renderedAfter).toContain('Ask a question against docs...'); // Placeholder should be visible again
    });

    it('streams AI tokens into the history list on response', async () => {
        const chat = new RAGChat({}, {
            ai: mockAI,
            vectorStore: mockVectorStore,
            docsPath: tempDocsDir,
            indexFn: mockIndexFn,
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

        // The streamed response should be rendered in the message area
        const screen = new Screen(60, 20);
        chat.updateRect({ x: 0, y: 0, width: 60, height: 20 });
        chat.render(screen);
        const rendered = screen.back.map(row => row.map(c => c.char).join('')).join('\n');
        expect(rendered).toContain('AI: Here is the answer.');
    });

    it('propagates index initialization errors and query errors to onError handler and events emitter', async () => {
        const initError = new Error('Init failed');
        mockVectorStore.load = vi.fn().mockRejectedValue(initError);
        const onErrorSpy = vi.fn();
        const eventSpy = vi.fn();

        const chat = new RAGChat({}, {
            ai: mockAI,
            vectorStore: mockVectorStore,
            docsPath: tempDocsDir,
            onError: onErrorSpy,
            indexFn: mockIndexFn,
        });
        chat.events.on('error' as any, eventSpy); // Cast needed: test subscribes to event key not represented in the typed event map.

        await flush();
        await flush();

        expect(onErrorSpy).toHaveBeenCalledWith(initError);
        expect(eventSpy).toHaveBeenCalledWith(initError);

        // Reset spy and simulate a query error
        onErrorSpy.mockReset();
        eventSpy.mockReset();
        mockVectorStore.load = vi.fn().mockResolvedValue(undefined);
        
        const queryError = new Error('Query failed');
        mockVectorStore.query = vi.fn().mockRejectedValue(queryError);

        const chat2 = new RAGChat({}, {
            ai: mockAI,
            vectorStore: mockVectorStore,
            docsPath: tempDocsDir,
            onError: onErrorSpy,
            indexFn: mockIndexFn,
        });
        chat2.events.on('error' as any, eventSpy); // Cast needed: test subscribes to event key not represented in the typed event map.
        await awaitIndex(mockVectorStore);

        chat2.isFocused = true;
        chat2.handleKey(makeKeyEvent('Q'));
        chat2.handleKey(makeKeyEvent('enter'));

        await flush();
        await flush();

        expect(onErrorSpy).toHaveBeenCalledWith(queryError);
        expect(eventSpy).toHaveBeenCalledWith(queryError);
    });
});
