import { describe, it, expect } from 'vitest';
import { render, screen, fireEvent } from '@solidjs/testing-library';
import { Textbook } from '../../src/components/textbook/Textbook';
import { User } from '../../src/models/user';

describe('Textbook Component', () => {
    const mockUser = {
        id: () => 1,
        email: () => 'test@example.com',
        firstName: () => 'Test',
        lastName: () => 'User',
        name: () => 'Test User'
    } as any as User;

    const mockTextbookData = {
        settings: {},
        version: 1,
        content: [
            {
                header: 'Chapter 1: Introduction'
            },
            {
                reading: {
                    id: 1,
                    url: 'intro',
                    name: 'Getting Started',
                    missing: false
                }
            },
            {
                header: 'Chapter 2: Basics',
                content: [
                    {
                        reading: {
                            id: 2,
                            url: 'variables',
                            name: 'Variables',
                            missing: false
                        }
                    },
                    {
                        reading: {
                            id: 3,
                            url: 'control-flow',
                            name: 'Control Flow',
                            missing: false
                        }
                    }
                ]
            }
        ]
    };

    it('should render textbook navigation', () => {
        render(() => (
            <Textbook
                courseId={1}
                textbook={mockTextbookData}
                isInstructor={false}
                user={mockUser}
            />
        ));

        expect(screen.getByText('Chapter 1: Introduction')).toBeTruthy();
        expect(screen.getByText('Getting Started')).toBeTruthy();
        expect(screen.getByText('Chapter 2: Basics')).toBeTruthy();
        expect(screen.getByText('Variables')).toBeTruthy();
        expect(screen.getByText('Control Flow')).toBeTruthy();
    });

    it('should display welcome message when no reading selected', () => {
        render(() => (
            <Textbook
                courseId={1}
                textbook={mockTextbookData}
                isInstructor={false}
                user={mockUser}
            />
        ));

        expect(screen.getByText('Welcome to the Textbook')).toBeTruthy();
        expect(screen.getByText(/Please select a reading/i)).toBeTruthy();
    });

    it('should mark reading as active when clicked', async () => {
        render(() => (
            <Textbook
                courseId={1}
                textbook={mockTextbookData}
                isInstructor={false}
                user={mockUser}
            />
        ));

        const readingLink = screen.getByText('Getting Started');
        fireEvent.click(readingLink);

        await new Promise(resolve => setTimeout(resolve, 100));

        // Check that the reading item has active class
        const readingElement = readingLink.closest('.list-group-item');
        expect(readingElement?.classList.contains('active')).toBe(true);
    });

    it('should render nested content with indentation', () => {
        const { container } = render(() => (
            <Textbook
                courseId={1}
                textbook={mockTextbookData}
                isInstructor={false}
                user={mockUser}
            />
        ));

        // Check that nested items exist
        const variablesElement = screen.getByText('Variables').closest('.list-group-item');
        const gettingStartedElement = screen.getByText('Getting Started').closest('.list-group-item');

        // Nested item should have more padding
        const variablesPadding = window.getComputedStyle(variablesElement!).paddingLeft;
        const gettingStartedPadding = window.getComputedStyle(gettingStartedElement!).paddingLeft;

        expect(parseFloat(variablesPadding)).toBeGreaterThan(parseFloat(gettingStartedPadding));
    });

    it('should not allow clicking on headers', () => {
        render(() => (
            <Textbook
                courseId={1}
                textbook={mockTextbookData}
                isInstructor={false}
                user={mockUser}
            />
        ));

        const header = screen.getByText('Chapter 1: Introduction');
        const headerElement = header.closest('.list-group-item');

        expect(headerElement?.classList.contains('disabled')).toBe(true);
        
        // Header should have default cursor
        expect(window.getComputedStyle(headerElement!).cursor).toContain('default');
    });

    it('should initialize with specified initial page', () => {
        const { container } = render(() => (
            <Textbook
                courseId={1}
                textbook={mockTextbookData}
                isInstructor={false}
                user={mockUser}
                initialPageId={2}
            />
        ));

        // The Variables reading (id: 2) should be active
        const variablesElement = screen.getByText('Variables').closest('.list-group-item');
        expect(variablesElement?.classList.contains('active')).toBe(true);
    });

    it('should handle empty textbook gracefully', () => {
        const emptyTextbook = {
            settings: {},
            version: 1,
            content: []
        };

        render(() => (
            <Textbook
                courseId={1}
                textbook={emptyTextbook}
                isInstructor={false}
                user={mockUser}
            />
        ));

        expect(screen.getByText('Welcome to the Textbook')).toBeTruthy();
    });

    it('should update URL when reading is selected', async () => {
        const pushStateSpy = vi.spyOn(window.history, 'pushState');

        render(() => (
            <Textbook
                courseId={1}
                textbook={mockTextbookData}
                isInstructor={false}
                user={mockUser}
            />
        ));

        const readingLink = screen.getByText('Getting Started');
        fireEvent.click(readingLink);

        await new Promise(resolve => setTimeout(resolve, 100));

        expect(pushStateSpy).toHaveBeenCalled();
        expect(pushStateSpy).toHaveBeenCalledWith(
            expect.objectContaining({ id: 1, url: 'intro', name: 'Getting Started' }),
            '',
            expect.any(String)
        );

        pushStateSpy.mockRestore();
    });

    it('should render deeply nested structure', () => {
        const deeplyNested = {
            settings: {},
            version: 1,
            content: [
                {
                    header: 'Part 1',
                    content: [
                        {
                            header: 'Chapter 1',
                            content: [
                                {
                                    header: 'Section 1.1',
                                    content: [
                                        {
                                            reading: {
                                                id: 1,
                                                url: 'deep',
                                                name: 'Deep Reading',
                                                missing: false
                                            }
                                        }
                                    ]
                                }
                            ]
                        }
                    ]
                }
            ]
        };

        render(() => (
            <Textbook
                courseId={1}
                textbook={deeplyNested}
                isInstructor={false}
                user={mockUser}
            />
        ));

        expect(screen.getByText('Part 1')).toBeTruthy();
        expect(screen.getByText('Chapter 1')).toBeTruthy();
        expect(screen.getByText('Section 1.1')).toBeTruthy();
        expect(screen.getByText('Deep Reading')).toBeTruthy();
    });
});
