export interface SubmissionData {
    id: number;
    assignment_id: number;
    user_id: number;
    course_id: number;
    assignment_group_id?: number;
    correct: boolean;
    score?: number;
    version?: string;
    date_created: string;
    date_modified: string;
    submission_status: string;
    grading_status: string;
    human_submission_status?: () => string;
    human_grading_status?: () => string;
}

export interface UserData {
    id: number;
    email: string;
    first_name: string;
    last_name: string;
    name: () => string;
    get_course_roles?: (courseId: number) => Array<{ name: string }>;
}

export interface AssignmentData {
    id: number;
    course_id: number;
    name: string;
    type: string;
    hidden: boolean;
    title: () => string;
}

export interface CourseData {
    id: number;
    name: string;
}

export interface GroupHeader {
    name: string;
}

export interface SubmissionFilterTableProps {
    submissions: Array<[SubmissionData, UserData, AssignmentData, CourseData]>;
    criteria?: 'assignment' | 'student' | null;
    searchKey?: number;
    courseId: number;
    groupHeaders?: Record<number, GroupHeader>;
    isInstructor: boolean;
}
