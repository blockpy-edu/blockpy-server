import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent } from '@solidjs/testing-library';
import { Reader } from '../../src/components/reader/Reader';
import { User } from '../../src/models/user';
import * as ajax from '../../src/services/ajax';

// Mock AJAX
vi.mock('../../src/services/ajax', () => ({
    ajax_post: vi.fn(),
    ajax_get: vi.fn()
}));

describe('Reader Component', () => {
    const mockUser = {
        id: () => 1,
        email: () => 'test@example.com',
        firstName: () => 'Test',
        lastName: () => 'User',
        name: () => 'Test User'
    } as any as User;

    const mockAssignmentResponse = {
        success: true,
        assignment: {
            id: 1,
            name: 'Test Reading',
            url: 'test-reading',
            instructions: '<p>This is a test reading</p>',
            settings: JSON.stringify({
                header: 'Test Header',
                summary: 'Test Summary',
                youtube: 'test_video_id'
            }),
            points: 10
        },
        submission: {
            id: 1,
            user_id: 1,
            assignment_id: 1,
            submission_status: 0,
            correct: false,
            date_started: null
        }
    };

    beforeEach(() => {
        vi.clearAllMocks();
        (ajax.ajax_post as any).mockResolvedValue(mockAssignmentResponse);
    });

    it('should render reader component', async () => {
        render(() => (
            <Reader
                courseId={1}
                currentAssignmentId={1}
                isInstructor={false}
                user={mockUser}
            />
        ));

        // Wait for loading
        await new Promise(resolve => setTimeout(resolve, 100));

        expect(ajax.ajax_post).toHaveBeenCalledWith('/blockpy/load_assignment', expect.any(Object));
    });

    it('should display header and summary when provided', async () => {
        render(() => (
            <Reader
                courseId={1}
                currentAssignmentId={1}
                isInstructor={false}
                user={mockUser}
            />
        ));

        await new Promise(resolve => setTimeout(resolve, 100));

        expect(screen.queryByText('Test Header')).toBeTruthy();
        expect(screen.queryByText('Test Summary')).toBeTruthy();
    });

    it('should show editor modes for instructors', async () => {
        render(() => (
            <Reader
                courseId={1}
                currentAssignmentId={1}
                isInstructor={true}
                user={mockUser}
            />
        ));

        await new Promise(resolve => setTimeout(resolve, 100));

        expect(screen.queryByText('Raw Editor')).toBeTruthy();
        expect(screen.queryByText('Form Editor')).toBeTruthy();
        expect(screen.queryByText('Actual Reader')).toBeTruthy();
    });

    it('should not show editor modes when asPreamble is true', async () => {
        render(() => (
            <Reader
                courseId={1}
                currentAssignmentId={1}
                isInstructor={true}
                asPreamble={true}
                user={mockUser}
            />
        ));

        await new Promise(resolve => setTimeout(resolve, 100));

        expect(screen.queryByText('Raw Editor')).toBeFalsy();
    });

    it('should call markRead when submission exists', async () => {
        const markReadSpy = vi.fn().mockResolvedValue({ success: true });
        (ajax.ajax_post as any).mockImplementation((url: string) => {
            if (url === '/blockpy/load_assignment') {
                return Promise.resolve(mockAssignmentResponse);
            } else if (url === '/blockpy/update_submission') {
                return markReadSpy();
            }
            return Promise.resolve({});
        });

        render(() => (
            <Reader
                courseId={1}
                currentAssignmentId={1}
                isInstructor={false}
                user={mockUser}
            />
        ));

        await new Promise(resolve => setTimeout(resolve, 200));

        expect(markReadSpy).toHaveBeenCalled();
    });

    it('should handle save assignment for instructors', async () => {
        const saveSpy = vi.fn().mockResolvedValue({ success: true });
        (ajax.ajax_post as any).mockImplementation((url: string) => {
            if (url === '/blockpy/load_assignment') {
                return Promise.resolve(mockAssignmentResponse);
            } else if (url === '/blockpy/save_assignment') {
                return saveSpy();
            } else if (url === '/blockpy/update_submission') {
                return Promise.resolve({ success: true });
            }
            return Promise.resolve({});
        });

        const alertSpy = vi.spyOn(window, 'alert').mockImplementation(() => {});

        render(() => (
            <Reader
                courseId={1}
                currentAssignmentId={1}
                isInstructor={true}
                user={mockUser}
            />
        ));

        await new Promise(resolve => setTimeout(resolve, 200));

        // Find and click save button
        const rawEditorRadio = screen.getByLabelText(/Raw Editor/i);
        fireEvent.click(rawEditorRadio);

        await new Promise(resolve => setTimeout(resolve, 100));

        const saveButton = screen.getByText('Save Assignment');
        fireEvent.click(saveButton);

        await new Promise(resolve => setTimeout(resolve, 100));

        expect(saveSpy).toHaveBeenCalled();
        expect(alertSpy).toHaveBeenCalledWith('Assignment saved successfully!');

        alertSpy.mockRestore();
    });

    it('should display YouTube video when configured', async () => {
        render(() => (
            <Reader
                courseId={1}
                currentAssignmentId={1}
                isInstructor={false}
                user={mockUser}
            />
        ));

        await new Promise(resolve => setTimeout(resolve, 100));

        const iframe = document.querySelector('#reader-youtube-video');
        expect(iframe).toBeTruthy();
        expect((iframe as HTMLIFrameElement).src).toContain('youtube.com/embed/test_video_id');
    });

    it('should handle video options with multiple voices', async () => {
        const multiVoiceResponse = {
            ...mockAssignmentResponse,
            assignment: {
                ...mockAssignmentResponse.assignment,
                settings: JSON.stringify({
                    youtube: {
                        'Dr. Smith': 'video1',
                        'Prof. Jones': 'video2'
                    }
                })
            }
        };

        (ajax.ajax_post as any).mockResolvedValue(multiVoiceResponse);

        render(() => (
            <Reader
                courseId={1}
                currentAssignmentId={1}
                isInstructor={false}
                user={mockUser}
            />
        ));

        await new Promise(resolve => setTimeout(resolve, 100));

        // Check that voice dropdown exists
        const voiceButton = screen.queryByText('Voice');
        expect(voiceButton).toBeTruthy();
    });

    it('should start exam timer when button clicked', async () => {
        const timerResponse = {
            ...mockAssignmentResponse,
            assignment: {
                ...mockAssignmentResponse.assignment,
                settings: JSON.stringify({
                    start_timer_button: true
                })
            }
        };

        const startTimerSpy = vi.fn().mockResolvedValue({ success: true });
        (ajax.ajax_post as any).mockImplementation((url: string) => {
            if (url === '/blockpy/load_assignment') {
                return Promise.resolve(timerResponse);
            } else if (url === '/blockpy/start_assignment') {
                return startTimerSpy();
            } else if (url === '/blockpy/update_submission') {
                return Promise.resolve({ success: true });
            }
            return Promise.resolve({});
        });

        render(() => (
            <Reader
                courseId={1}
                currentAssignmentId={1}
                isInstructor={false}
                user={mockUser}
            />
        ));

        await new Promise(resolve => setTimeout(resolve, 200));

        const startButton = screen.getByText(/I am ready to start the exam/i);
        expect(startButton).toBeTruthy();

        fireEvent.click(startButton);

        await new Promise(resolve => setTimeout(resolve, 100));

        expect(startTimerSpy).toHaveBeenCalled();
    });
});
