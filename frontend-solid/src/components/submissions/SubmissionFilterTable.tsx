import { createSignal, For, Show, createMemo } from 'solid-js';
import { SubmissionData, UserData, AssignmentData, CourseData, SubmissionFilterTableProps, GroupHeader } from './types';

export function SubmissionFilterTable(props: SubmissionFilterTableProps) {
    const [sortColumn, setSortColumn] = createSignal<number>(-1);
    const [sortDirection, setSortDirection] = createSignal<'asc' | 'desc'>('asc');
    const [showOnlyLearners, setShowOnlyLearners] = createSignal(true);
    const [bulkRegradeStatus, setBulkRegradeStatus] = createSignal('');

    const rows = createMemo(() => {
        return props.submissions.map(([submission, user, assignment, course]) => ({
            submission,
            user,
            assignment,
            course,
            hasLearnerRole: user ? user.get_course_roles?.(props.courseId)?.some((r: any) => r.name === 'Learner') : false
        }));
    });

    const sortedRows = createMemo(() => {
        const rowList = [...rows()];
        const col = sortColumn();
        if (col === -1) return rowList;

        const dir = sortDirection();
        const multiplier = dir === 'asc' ? 1 : -1;

        rowList.sort((a, b) => {
            let cellA: any, cellB: any;
            
            // Simplified column mapping
            if (col === 0 && props.criteria !== 'assignment') {
                cellA = a.assignment.title();
                cellB = b.assignment.title();
            } else if (props.criteria !== 'student' && ((props.criteria === 'assignment' && col === 0) || col === 1)) {
                cellA = a.user.name();
                cellB = b.user.name();
            } else {
                // Default to string comparison
                cellA = '';
                cellB = '';
            }

            if (typeof cellA === 'number' && typeof cellB === 'number') {
                return multiplier * (cellA - cellB);
            }
            return multiplier * String(cellA).localeCompare(String(cellB));
        });

        return rowList;
    });

    const handleSort = (columnIndex: number) => {
        if (sortColumn() === columnIndex) {
            setSortDirection(sortDirection() === 'asc' ? 'desc' : 'asc');
        } else {
            setSortColumn(columnIndex);
            setSortDirection('asc');
        }
    };

    const getRowClass = (row: any) => {
        const { submission, assignment, hasLearnerRole } = row;
        let className = '';

        if (submission.correct || (submission.score !== undefined && submission.score >= 100) || assignment.type === 'reading') {
            className = 'table-success';
        } else if (submission.score !== undefined && submission.score > 0) {
            className = 'table-warning';
        }

        if (!hasLearnerRole) {
            className += ' non-learner-row';
        }

        return className;
    };

    const formatDate = (dateStr: string) => {
        const date = new Date(dateStr);
        const now = new Date();
        const diffMs = now.getTime() - date.getTime();
        const diffMins = Math.floor(diffMs / 60000);
        const diffHours = Math.floor(diffMins / 60);
        const diffDays = Math.floor(diffHours / 24);

        if (diffMins < 1) return 'Just now';
        if (diffMins < 60) return `${diffMins} min ago`;
        if (diffHours < 24) return `${diffHours} hour${diffHours > 1 ? 's' : ''} ago`;
        if (diffDays < 7) return `${diffDays} day${diffDays > 1 ? 's' : ''} ago`;
        
        return date.toLocaleDateString();
    };

    const handleRegrade = async (submissionId: number, asHuman: boolean, button: HTMLElement) => {
        try {
            const response = await fetch('/assignments/regrade', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ submission_id: submissionId, as_human: asHuman })
            });
            const data = await response.json();
            
            if (data.success) {
                const icon = button.querySelector('.status-icon');
                if (icon && data.grading_status === 'FullyGraded') {
                    icon.innerHTML = '&#10004;';
                } else if (icon && data.grading_status === 'Failed') {
                    icon.innerHTML = '&#10060;';
                }
            }
        } catch (error) {
            console.error('Regrade failed:', error);
        }
    };

    const handleBulkRegrade = async (asHuman: boolean) => {
        const buttons = document.querySelectorAll(`button.re-autograde-btn[data-as-human="${asHuman}"]`) as NodeListOf<HTMLElement>;
        let finished = 0;
        setBulkRegradeStatus(`Bulk regrading... (${finished}/${buttons.length})`);

        const overlay = document.querySelector('.overlay') as HTMLElement;
        if (overlay) overlay.style.display = 'block';

        for (let i = 0; i < buttons.length; i++) {
            await new Promise(resolve => setTimeout(resolve, 200 * i));
            buttons[i].click();
            finished++;
            setBulkRegradeStatus(
                finished === buttons.length
                    ? `Bulk regrading complete (${finished}/${buttons.length})`
                    : `Bulk regrading... (${finished}/${buttons.length})`
            );
        }

        if (overlay) overlay.style.display = 'none';
    };

    const estimateDuration = async (submissionId: number, element: HTMLElement) => {
        try {
            const response = await fetch(`/assignments/estimate_duration?submission_id=${submissionId}`);
            const data = await response.json();
            if (data.duration !== undefined) {
                element.title = `Estimated: ${data.duration} minutes`;
            }
        } catch (error) {
            console.error('Estimate duration failed:', error);
        }
    };

    return (
        <div>
            <Show when={props.isInstructor}>
                <div class="float-right">
                    <span id="bulk-regrade-status">{bulkRegradeStatus()}</span>
                    <div class="btn-group mt-2">
                        <button
                            class="bulk-regrade btn btn-outline-secondary"
                            onClick={() => handleBulkRegrade(false)}
                            title="Simulate clicking on all of the regrade buttons"
                        >
                            Bulk regrade
                        </button>
                        <button type="button" class="btn btn-outline-secondary dropdown-toggle" data-toggle="dropdown">
                            <span class="caret"></span>
                        </button>
                        <div class="dropdown-menu dropdown-menu-right">
                            <button
                                class="bulk-regrade btn btn-outline-secondary"
                                onClick={() => handleBulkRegrade(true)}
                            >
                                Bulk regrade (as human)
                            </button>
                        </div>
                    </div>
                </div>

                <Show when={props.criteria === 'assignment'}>
                    <input
                        type="checkbox"
                        id="show-only-learners"
                        checked={showOnlyLearners()}
                        onChange={(e) => setShowOnlyLearners(e.currentTarget.checked)}
                    />
                    <label for="show-only-learners">Show only learners</label>
                </Show>
            </Show>

            <table class="table table-condensed table-hover table-striped table-bordered" id="submission-table">
                <caption>Student submissions</caption>
                <thead class="thead-dark">
                    <tr>
                        <Show when={props.criteria !== 'assignment'}>
                            <th onClick={() => handleSort(0)} style="cursor: pointer">
                                Assignment
                                <Show when={sortColumn() === 0}>
                                    <i class={`ml-2 fas fa-arrow-${sortDirection() === 'asc' ? 'up' : 'down'}`}></i>
                                </Show>
                            </th>
                        </Show>
                        <Show when={props.criteria !== 'student'}>
                            <th onClick={() => handleSort(props.criteria === 'assignment' ? 0 : 1)} style="cursor: pointer">
                                Student
                            </th>
                            <th>Role</th>
                        </Show>
                        <th>Correct/Score</th>
                        <th>Submission Status</th>
                        <th>Grading Status</th>
                        <th>Edits</th>
                        <th>Created</th>
                        <th>Last Edited</th>
                        <th>Actions</th>
                    </tr>
                </thead>
                <tbody>
                    <For each={sortedRows()}>
                        {(row) => (
                            <tr class={getRowClass(row)} style={!showOnlyLearners() || row.hasLearnerRole ? '' : 'display: none'}>
                                <Show when={props.criteria !== 'assignment'}>
                                    <td>
                                        <a href={`/courses/submissions_filter?criteria=assignment&search_key=${row.assignment.id}&course_id=${props.courseId}`}>
                                            <i class="fas fa-eye"></i>
                                        </a> {row.assignment.title()}
                                    </td>
                                </Show>
                                <Show when={props.criteria !== 'student'}>
                                    <td>
                                        <a href={`/courses/submissions_filter?criteria=student&search_key=${row.user.id}&course_id=${props.courseId}`}>
                                            <i class="fas fa-eye"></i>
                                        </a> {row.user.name()}
                                    </td>
                                    <td>
                                        {row.user.get_course_roles?.(props.courseId)?.map((r: any) => r.name).join(', ')}
                                    </td>
                                </Show>
                                <td>
                                    {row.submission.correct ? 'Yes' : 'No'}
                                    <Show when={row.submission.score !== undefined}>
                                        {' '}({Math.round(row.submission.score * 10) / 10}%)
                                    </Show>
                                </td>
                                <td>{row.submission.human_submission_status?.() || row.submission.submission_status}</td>
                                <td>
                                    <span>
                                        <Show when={row.submission.grading_status === 'FullyGraded'}>
                                            <span class="green-check-mark">✓</span>
                                        </Show>
                                        <Show when={row.submission.grading_status === 'Failed'}>
                                            <span class="red-x">✗</span>
                                        </Show>
                                    </span>
                                    {' '}{row.submission.human_grading_status?.() || row.submission.grading_status}
                                </td>
                                <td>
                                    <span
                                        onClick={(e) => estimateDuration(row.submission.id, e.currentTarget)}
                                        style="cursor: pointer"
                                    >
                                        {row.submission.version || '0'}
                                    </span>
                                </td>
                                <td>
                                    <span title={row.submission.date_created}>
                                        {formatDate(row.submission.date_created)}
                                    </span>
                                </td>
                                <td>
                                    <span title={row.submission.date_modified}>
                                        {formatDate(row.submission.date_modified)}
                                    </span>
                                </td>
                                <td>
                                    <div class="btn-group">
                                        <a
                                            href={`/blockpy/view_submission?submission_id=${row.submission.id}&embed=True`}
                                            target="_blank"
                                            class="btn btn-primary btn-sm"
                                        >
                                            View
                                        </a>
                                        <button type="button" class="btn btn-primary dropdown-toggle btn-sm" data-toggle="dropdown">
                                            <span class="caret"></span>
                                        </button>
                                        <div class="dropdown-menu dropdown-menu-right">
                                            <Show when={props.isInstructor}>
                                                <a
                                                    href={`/blockpy/load_assignment?assignment_id=${row.assignment.id}&user_id=${row.user.id}&course_id=${props.courseId}&force_download=True&embed=True`}
                                                    target="_blank"
                                                    class="dropdown-item"
                                                >
                                                    Download
                                                </a>
                                                <For each={[false, true]}>
                                                    {(asHuman) => (
                                                        <button
                                                            class="dropdown-item re-autograde-btn"
                                                            type="button"
                                                            onClick={(e) => handleRegrade(row.submission.id, asHuman, e.currentTarget)}
                                                            data-as-human={asHuman}
                                                            style="cursor: pointer"
                                                        >
                                                            <span class="status-icon"></span>
                                                            {asHuman ? 'Regrade as human' : 'Regrade'}
                                                        </button>
                                                    )}
                                                </For>
                                            </Show>
                                        </div>
                                    </div>
                                </td>
                            </tr>
                        )}
                    </For>
                </tbody>
            </table>
        </div>
    );
}
