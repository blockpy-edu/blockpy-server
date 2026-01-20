import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { AssignmentInterface, parseTimeLimit, formatAmount, EditorMode } from '../../src/services/assignment-interface';
import { User } from '../../src/models/user';
import { ajax_post } from '../../src/services/ajax';

// Mock the ajax service
vi.mock('../../src/services/ajax', () => ({
    ajax_post: vi.fn()
}));

describe('parseTimeLimit', () => {
    it('should parse time in minutes', () => {
        expect(parseTimeLimit('60min', null)).toBe(3600);
        expect(parseTimeLimit('90min', null)).toBe(5400);
        expect(parseTimeLimit('120min', null)).toBe(7200);
    });

    it('should parse plain numbers as minutes', () => {
        expect(parseTimeLimit('60', null)).toBe(3600);
        expect(parseTimeLimit('90', null)).toBe(5400);
    });

    it('should handle student time limit with multiplier', () => {
        expect(parseTimeLimit('60min', '2x')).toBe(7200); // 60 * 2 = 120 min
        expect(parseTimeLimit('90min', '1.5x')).toBe(8100); // 90 * 1.5 = 135 min
    });

    it('should handle absolute student time limit', () => {
        expect(parseTimeLimit('60min', '30min')).toBe(1800); // 30 min absolute
        expect(parseTimeLimit('90min', '45min')).toBe(2700); // 45 min absolute
    });

    it('should handle invalid formats gracefully', () => {
        expect(parseTimeLimit('invalid', null)).toBe(0);
        expect(parseTimeLimit('60min', 'invalid')).toBe(3600); // Falls back to base
    });
});

describe('formatAmount', () => {
    it('should format seconds only', () => {
        expect(formatAmount(30, ' left')).toBe('30s left');
        expect(formatAmount(45, ' elapsed')).toBe('45s elapsed');
    });

    it('should format minutes and seconds', () => {
        expect(formatAmount(90, ' left')).toBe('1m 30s left');
        expect(formatAmount(125, ' elapsed')).toBe('2m 5s elapsed');
    });

    it('should format hours, minutes, and seconds', () => {
        expect(formatAmount(3665, ' left')).toBe('1h 1m 5s left');
        expect(formatAmount(7325, ' elapsed')).toBe('2h 2m 5s elapsed');
    });

    it('should hide seconds when specified', () => {
        expect(formatAmount(3665, ' left', false)).toBe('1h 1m left');
        expect(formatAmount(125, ' elapsed', false)).toBe('2m elapsed');
    });

    it('should handle zero time', () => {
        expect(formatAmount(0, ' left')).toBe('0s left');
    });
});

describe('AssignmentInterface', () => {
    let user: User;
    let assignmentInterface: AssignmentInterface;
    
    beforeEach(() => {
        user = new User({
            id: 1,
            first_name: 'Test',
            last_name: 'User',
            email: 'test@example.com'
        });

        // Clear all mocks
        vi.clearAllMocks();
        
        // Mock DOM elements for timer display
        document.body.innerHTML = `
            <div class="assignment-selector-countdown"></div>
            <div class="assignment-selector-clock"></div>
        `;
    });

    afterEach(() => {
        if (assignmentInterface) {
            assignmentInterface.dispose();
        }
        vi.restoreAllMocks();
    });

    it('should initialize with config', () => {
        assignmentInterface = new AssignmentInterface({
            courseId: 123,
            assignmentGroupId: 456,
            user,
            isInstructor: false,
            currentAssignmentId: 789
        });

        expect(assignmentInterface.courseId).toBe(123);
        expect(assignmentInterface.assignmentGroupId).toBe(456);
        expect(assignmentInterface.user).toBe(user);
        expect(assignmentInterface.isInstructor()).toBe(false);
        expect(assignmentInterface.assignment()).toBeNull();
        expect(assignmentInterface.submission()).toBeNull();
    });

    it('should set instructor mode', () => {
        assignmentInterface = new AssignmentInterface({
            courseId: 123,
            assignmentGroupId: 456,
            user,
            isInstructor: true
        });

        expect(assignmentInterface.isInstructor()).toBe(true);
        
        assignmentInterface.setIsInstructor(false);
        expect(assignmentInterface.isInstructor()).toBe(false);
    });

    it('should call markCorrect callback', () => {
        const markCorrectFn = vi.fn();
        
        assignmentInterface = new AssignmentInterface({
            courseId: 123,
            assignmentGroupId: 456,
            user,
            isInstructor: false,
            markCorrect: markCorrectFn
        });

        if (assignmentInterface.markCorrect) {
            assignmentInterface.markCorrect(789);
        }
        
        expect(markCorrectFn).toHaveBeenCalledWith(789);
    });

    it('should load assignment successfully', async () => {
        assignmentInterface = new AssignmentInterface({
            courseId: 123,
            assignmentGroupId: 456,
            user,
            isInstructor: false
        });

        const mockResponse = {
            success: true,
            assignment: {
                id: 789,
                name: 'Test Assignment',
                url: 'test-assignment',
                instructions: '# Test',
                settings: '{}',
                points: 100,
                version: 1
            },
            submission: {
                id: 101,
                code: '{}',
                submission_status: 0,
                correct: false,
                date_started: null
            }
        };

        vi.mocked(ajax_post).mockResolvedValueOnce(mockResponse);

        const result = await assignmentInterface.loadAssignment(789);
        
        expect(result.assignment).toBeDefined();
        expect(result.assignment.id).toBe(789);
        expect(result.submission).toBeDefined();
        expect(result.submission?.id).toBe(101);
        expect(assignmentInterface.assignment()).toBeDefined();
        expect(assignmentInterface.submission()).toBeDefined();
    });

    it('should handle load assignment failure', async () => {
        assignmentInterface = new AssignmentInterface({
            courseId: 123,
            assignmentGroupId: 456,
            user,
            isInstructor: false
        });

        const mockResponse = {
            success: false,
            message: { message: 'Assignment not found' }
        };

        (global.fetch as any).mockResolvedValueOnce({
            ok: true,
            json: async () => mockResponse
        });

        await expect(assignmentInterface.loadAssignment(789)).rejects.toThrow('Assignment not found');
        expect(assignmentInterface.assignment()).toBeNull();
        expect(assignmentInterface.submission()).toBeNull();
    });

    it('should save file successfully', async () => {
        assignmentInterface = new AssignmentInterface({
            courseId: 123,
            assignmentGroupId: 456,
            user,
            isInstructor: false
        });

        // Set up assignment and submission
        assignmentInterface.setAssignment({
            id: 789,
            version: () => 1,
            url: () => 'test'
        } as any);
        
        assignmentInterface.setSubmission({
            id: 101
        } as any);

        const mockResponse = { success: true };
        (global.fetch as any).mockResolvedValueOnce({
            ok: true,
            json: async () => mockResponse
        });

        const onSuccess = vi.fn();
        const result = await assignmentInterface.saveFile(
            'answer.py',
            'print("Hello")',
            false,
            onSuccess
        );

        expect(result.success).toBe(true);
        expect(onSuccess).toHaveBeenCalledWith(mockResponse);
    });

    it('should log event successfully', async () => {
        assignmentInterface = new AssignmentInterface({
            courseId: 123,
            assignmentGroupId: 456,
            user,
            isInstructor: false
        });

        // Set up assignment and submission
        assignmentInterface.setAssignment({
            id: 789,
            version: () => 1,
            url: () => 'test'
        } as any);
        
        assignmentInterface.setSubmission({
            id: 101
        } as any);

        const mockResponse = { success: true };
        (global.fetch as any).mockResolvedValueOnce({
            ok: true,
            json: async () => mockResponse
        });

        const callback = vi.fn();
        const result = await assignmentInterface.logEvent(
            'Resource.View',
            'reading',
            'read',
            JSON.stringify({ count: 1 }),
            'test-assignment',
            callback
        );

        expect(result.success).toBe(true);
        expect(callback).toHaveBeenCalledWith(mockResponse);
    });

    it('should save assignment settings', async () => {
        assignmentInterface = new AssignmentInterface({
            courseId: 123,
            assignmentGroupId: 456,
            user,
            isInstructor: true
        });

        // Set up assignment and submission
        assignmentInterface.setAssignment({
            id: 789,
            version: () => 1
        } as any);
        
        assignmentInterface.setSubmission({
            id: 101
        } as any);

        const mockResponse = { success: true };
        (global.fetch as any).mockResolvedValueOnce({
            ok: true,
            json: async () => mockResponse
        });

        const result = await assignmentInterface.saveAssignmentSettings({
            settings: '{"time_limit": "60min"}',
            points: 100,
            name: 'Updated Assignment'
        });

        expect(result.success).toBe(true);
    });

    it('should clean up time checker on dispose', () => {
        assignmentInterface = new AssignmentInterface({
            courseId: 123,
            assignmentGroupId: 456,
            user,
            isInstructor: false
        });

        const clearIntervalSpy = vi.spyOn(global, 'clearInterval');
        
        assignmentInterface.dispose();
        
        expect(clearIntervalSpy).toHaveBeenCalled();
    });
});

describe('EditorMode', () => {
    it('should have correct enum values', () => {
        expect(EditorMode.SUBMISSION).toBe('SUBMISSION');
        expect(EditorMode.RAW).toBe('RAW');
        expect(EditorMode.FORM).toBe('FORM');
    });
});
