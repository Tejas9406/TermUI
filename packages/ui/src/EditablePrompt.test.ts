import { describe, it, expect, vi } from 'vitest';
// @ts-expect-error — pre-existing monorepo DTS issue
import { Screen, type KeyEvent } from '@termuijs/core';
import { EditablePrompt } from './EditablePrompt.js';

const MIXED_CHOICES = [
    { type: 'checkbox' as const, name: 'verbose', message: 'Verbose output' },
    { type: 'text' as const, name: 'output', message: 'Output path', initial: './dist' },
    { type: 'checkbox' as const, name: 'minify', message: 'Minify' },
];

describe('EditablePrompt', () => {
    describe('Initialization', () => {
        it('initializes with correct result', () => {
            const prompt = new EditablePrompt({
                choices: MIXED_CHOICES,
            });

            const result = prompt.result;
            expect(result.selected).toEqual([]);
            expect(result.values.output).toBe('./dist');
        });

        it('initializes with message', () => {
            const prompt = new EditablePrompt({
                message: 'Configure options',
                choices: MIXED_CHOICES,
            });

            const screen = new Screen(40, 10);
            prompt.updateRect({ x: 0, y: 0, width: 40, height: 10 });
            prompt.render(screen);

            const row0 = screen.back[0].map((c: any) => c.char).join('').trim();
            expect(row0).toContain('Configure options');
        });
    });

    describe('Checkbox Toggle', () => {
        it('toggles checkbox on space key', () => {
            const prompt = new EditablePrompt({
                choices: MIXED_CHOICES,
            });

            prompt.handleKey({ key: 'space' } as Partial<KeyEvent> as KeyEvent);

            expect(prompt.result.selected).toContain('verbose');
        });

        it('toggles multiple checkboxes', () => {
            const prompt = new EditablePrompt({
                choices: MIXED_CHOICES,
            });

            // Select first checkbox
            prompt.handleKey({ key: 'space' } as Partial<KeyEvent> as KeyEvent);
            expect(prompt.result.selected).toEqual(['verbose']);

            // Navigate down to skip text field
            prompt.handleKey({ key: 'down' } as Partial<KeyEvent> as KeyEvent);
            prompt.handleKey({ key: 'down' } as Partial<KeyEvent> as KeyEvent);

            // Select third checkbox (minify)
            prompt.handleKey({ key: 'space' } as Partial<KeyEvent> as KeyEvent);
            expect(prompt.result.selected).toEqual(['verbose', 'minify']);
        });

        it('untoggle checkbox on second space', () => {
            const prompt = new EditablePrompt({
                choices: MIXED_CHOICES,
            });

            prompt.handleKey({ key: 'space' } as Partial<KeyEvent> as KeyEvent);
            expect(prompt.result.selected).toContain('verbose');

            prompt.handleKey({ key: 'space' } as Partial<KeyEvent> as KeyEvent);
            expect(prompt.result.selected).toEqual([]);
        });

        it('renders checked checkboxes correctly', () => {
            const prompt = new EditablePrompt({
                choices: MIXED_CHOICES,
            });

            prompt.handleKey({ key: 'space' } as Partial<KeyEvent> as KeyEvent);

            const screen = new Screen(50, 10);
            prompt.updateRect({ x: 0, y: 0, width: 50, height: 10 });
            prompt.render(screen);

            const row0 = screen.back[0].map((c: any) => c.char).join('').trim();
            expect(row0).toContain('[x]');
        });
    });

    describe('Text Field Editing', () => {
        it('enters edit mode on enter key', () => {
            const prompt = new EditablePrompt({
                choices: MIXED_CHOICES,
            });

            // Navigate to text field (index 1)
            prompt.handleKey({ key: 'down' } as Partial<KeyEvent> as KeyEvent);

            // Enter edit mode
            prompt.handleKey({ key: 'enter' } as Partial<KeyEvent> as KeyEvent);

            const screen = new Screen(50, 10);
            prompt.updateRect({ x: 0, y: 0, width: 50, height: 10 });
            prompt.render(screen);

            const row1 = screen.back[1].map((c: any) => c.char).join('').trim();
            expect(row1).toContain('_'); // Editing cursor
        });

        it('appends characters while editing', () => {
            const prompt = new EditablePrompt({
                choices: MIXED_CHOICES,
            });

            prompt.handleKey({ key: 'down' } as Partial<KeyEvent> as KeyEvent);
            prompt.handleKey({ key: 'enter' } as Partial<KeyEvent> as KeyEvent);

            // Clear existing and add new value
            prompt.handleKey({ key: 'backspace' } as Partial<KeyEvent> as KeyEvent);
            prompt.handleKey({ key: 'backspace' } as Partial<KeyEvent> as KeyEvent);
            prompt.handleKey({ key: 'backspace' } as Partial<KeyEvent> as KeyEvent);
            prompt.handleKey({ key: 'backspace' } as Partial<KeyEvent> as KeyEvent);
            prompt.handleKey({ key: 'backspace' } as Partial<KeyEvent> as KeyEvent);
            prompt.handleKey({ key: 'backspace' } as Partial<KeyEvent> as KeyEvent);
            prompt.handleKey({ key: 'backspace' } as Partial<KeyEvent> as KeyEvent);

            prompt.handleKey({ key: 'b' } as Partial<KeyEvent> as KeyEvent);
            prompt.handleKey({ key: 'u' } as Partial<KeyEvent> as KeyEvent);
            prompt.handleKey({ key: 'i' } as Partial<KeyEvent> as KeyEvent);
            prompt.handleKey({ key: 'l' } as Partial<KeyEvent> as KeyEvent);
            prompt.handleKey({ key: 'd' } as Partial<KeyEvent> as KeyEvent);

            // Submit edit
            prompt.handleKey({ key: 'enter' } as Partial<KeyEvent> as KeyEvent);

            expect(prompt.result.values.output).toBe('build');
        });

        it('cancels edit on escape key', () => {
            const prompt = new EditablePrompt({
                choices: MIXED_CHOICES,
            });

            const initialValue = prompt.result.values.output;

            prompt.handleKey({ key: 'down' } as Partial<KeyEvent> as KeyEvent);
            prompt.handleKey({ key: 'enter' } as Partial<KeyEvent> as KeyEvent);

            // Type something
            prompt.handleKey({ key: 'x' } as Partial<KeyEvent> as KeyEvent);
            prompt.handleKey({ key: 'y' } as Partial<KeyEvent> as KeyEvent);
            prompt.handleKey({ key: 'z' } as Partial<KeyEvent> as KeyEvent);

            // Cancel
            prompt.handleKey({ key: 'escape' } as Partial<KeyEvent> as KeyEvent);

            // Value should remain unchanged
            expect(prompt.result.values.output).toBe(initialValue);
        });

        it('handles backspace while editing', () => {
            const prompt = new EditablePrompt({
                choices: MIXED_CHOICES,
            });

            prompt.handleKey({ key: 'down' } as Partial<KeyEvent> as KeyEvent);
            prompt.handleKey({ key: 'enter' } as Partial<KeyEvent> as KeyEvent);

            // Clear initial value
            prompt.handleKey({ key: 'backspace' } as Partial<KeyEvent> as KeyEvent);
            prompt.handleKey({ key: 'backspace' } as Partial<KeyEvent> as KeyEvent);
            prompt.handleKey({ key: 'backspace' } as Partial<KeyEvent> as KeyEvent);
            prompt.handleKey({ key: 'backspace' } as Partial<KeyEvent> as KeyEvent);
            prompt.handleKey({ key: 'backspace' } as Partial<KeyEvent> as KeyEvent);
            prompt.handleKey({ key: 'backspace' } as Partial<KeyEvent> as KeyEvent);
            prompt.handleKey({ key: 'backspace' } as Partial<KeyEvent> as KeyEvent);

            prompt.handleKey({ key: 't' } as Partial<KeyEvent> as KeyEvent);
            prompt.handleKey({ key: 'e' } as Partial<KeyEvent> as KeyEvent);
            prompt.handleKey({ key: 's' } as Partial<KeyEvent> as KeyEvent);
            prompt.handleKey({ key: 'backspace' } as Partial<KeyEvent> as KeyEvent);

            prompt.handleKey({ key: 'enter' } as Partial<KeyEvent> as KeyEvent);

            expect(prompt.result.values.output).toBe('te');
        });

        it('renders text field with current value', () => {
            const prompt = new EditablePrompt({
                choices: MIXED_CHOICES,
            });

            const screen = new Screen(50, 10);
            prompt.updateRect({ x: 0, y: 0, width: 50, height: 10 });
            prompt.render(screen);

            const row1 = screen.back[1].map((c: any) => c.char).join('').trim();
            expect(row1).toContain('Output path');
            expect(row1).toContain('./dist');
        });
    });

    describe('Navigation', () => {
        it('navigates down through items', () => {
            const prompt = new EditablePrompt({
                choices: MIXED_CHOICES,
            });

            const screen = new Screen(50, 10);
            prompt.updateRect({ x: 0, y: 0, width: 50, height: 10 });

            // At index 0
            prompt.render(screen);
            let row0 = screen.back[0].map((c: any) => c.char).join('').trim();
            expect(row0).toContain('❯');

            // Navigate down
            prompt.handleKey({ key: 'down' } as Partial<KeyEvent> as KeyEvent);
            prompt.render(screen);
            row0 = screen.back[0].map((c: any) => c.char).join('').trim();
            const row1 = screen.back[1].map((c: any) => c.char).join('').trim();
            expect(row0).not.toContain('❯');
            expect(row1).toContain('❯');
        });

        it('navigates up through items', () => {
            const prompt = new EditablePrompt({
                choices: MIXED_CHOICES,
            });

            prompt.handleKey({ key: 'down' } as Partial<KeyEvent> as KeyEvent);
            prompt.handleKey({ key: 'down' } as Partial<KeyEvent> as KeyEvent);

            // Navigate up
            prompt.handleKey({ key: 'up' } as Partial<KeyEvent> as KeyEvent);

            const screen = new Screen(50, 10);
            prompt.updateRect({ x: 0, y: 0, width: 50, height: 10 });
            prompt.render(screen);

            const row1 = screen.back[1].map((c: any) => c.char).join('').trim();
            expect(row1).toContain('❯');
        });

        it('does not navigate while editing', () => {
            const prompt = new EditablePrompt({
                choices: MIXED_CHOICES,
            });

            prompt.handleKey({ key: 'down' } as Partial<KeyEvent> as KeyEvent);
            prompt.handleKey({ key: 'enter' } as Partial<KeyEvent> as KeyEvent); // Enter edit mode

            // Try to navigate
            prompt.handleKey({ key: 'down' } as Partial<KeyEvent> as KeyEvent);
            prompt.handleKey({ key: 'up' } as Partial<KeyEvent> as KeyEvent);

            // Should still be editing text field (index 1)
            const result = prompt.result;
            // After submitting edit, value should still be at text field's initial value
        });
    });

    describe('Mixed List', () => {
        it('handles mixed checkbox and text fields', () => {
            const prompt = new EditablePrompt({
                choices: MIXED_CHOICES,
            });

            // Check first checkbox
            prompt.handleKey({ key: 'space' } as Partial<KeyEvent> as KeyEvent);

            // Navigate to text field and edit it
            prompt.handleKey({ key: 'down' } as Partial<KeyEvent> as KeyEvent);
            prompt.handleKey({ key: 'enter' } as Partial<KeyEvent> as KeyEvent);
            prompt.handleKey({ key: 'backspace' } as Partial<KeyEvent> as KeyEvent);
            prompt.handleKey({ key: 'backspace' } as Partial<KeyEvent> as KeyEvent);
            prompt.handleKey({ key: 'backspace' } as Partial<KeyEvent> as KeyEvent);
            prompt.handleKey({ key: 'backspace' } as Partial<KeyEvent> as KeyEvent);
            prompt.handleKey({ key: 'backspace' } as Partial<KeyEvent> as KeyEvent);
            prompt.handleKey({ key: 'backspace' } as Partial<KeyEvent> as KeyEvent);
            prompt.handleKey({ key: 'backspace' } as Partial<KeyEvent> as KeyEvent);
            prompt.handleKey({ key: 'b' } as Partial<KeyEvent> as KeyEvent);
            prompt.handleKey({ key: 'u' } as Partial<KeyEvent> as KeyEvent);
            prompt.handleKey({ key: 'i' } as Partial<KeyEvent> as KeyEvent);
            prompt.handleKey({ key: 'l' } as Partial<KeyEvent> as KeyEvent);
            prompt.handleKey({ key: 'd' } as Partial<KeyEvent> as KeyEvent);
            prompt.handleKey({ key: 'enter' } as Partial<KeyEvent> as KeyEvent);

            // Navigate to third checkbox and check it
            prompt.handleKey({ key: 'down' } as Partial<KeyEvent> as KeyEvent);
            prompt.handleKey({ key: 'space' } as Partial<KeyEvent> as KeyEvent);

            const result = prompt.result;
            expect(result.selected).toEqual(['verbose', 'minify']);
            expect(result.values.output).toBe('build');
        });
    });

    describe('Callback', () => {
        it('calls onChange when checkbox toggled', () => {
            const onChange = vi.fn();
            const prompt = new EditablePrompt({
                choices: MIXED_CHOICES,
                onChange,
            });

            prompt.handleKey({ key: 'space' } as Partial<KeyEvent> as KeyEvent);

            expect(onChange).toHaveBeenCalledWith({
                selected: ['verbose'],
                values: { output: './dist' },
            });
        });

        it('calls onChange when text value submitted', () => {
            const onChange = vi.fn();
            const prompt = new EditablePrompt({
                choices: MIXED_CHOICES,
                onChange,
            });

            prompt.handleKey({ key: 'down' } as Partial<KeyEvent> as KeyEvent);
            prompt.handleKey({ key: 'enter' } as Partial<KeyEvent> as KeyEvent);
            prompt.handleKey({ key: 'x' } as Partial<KeyEvent> as KeyEvent);
            prompt.handleKey({ key: 'enter' } as Partial<KeyEvent> as KeyEvent);

            expect(onChange).toHaveBeenCalledWith(
                expect.objectContaining({
                    values: expect.objectContaining({
                        output: expect.stringContaining('x'),
                    }),
                })
            );
        });
    });
});
