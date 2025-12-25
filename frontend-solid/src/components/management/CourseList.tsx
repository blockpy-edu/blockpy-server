import { Component, createSignal, createMemo, For, Show } from 'solid-js';
import type { User } from '../../models/user';
import { ajax_post } from '../../services/ajax';

export enum SortMethod {
    DATE_CREATED_DESC = 'date_created_desc',
    DATE_CREATED_ASC = 'date_created_asc',
    NAME_ASC = 'name_asc',
    NAME_DESC = 'name_desc'
}

export interface Course {
    id: number;
    name: string;
    url?: string;
    service?: string;
    dateCreated: Date;
    prettyDateCreated: string;
    isPinned: boolean;
    settings?: any;
}

interface CourseListProps {
    courses: Course[];
    user: User;
    label: string;
}

export const CourseList: Component<CourseListProps> = (props) => {
    const [sortMethod, setSortMethod] = createSignal<SortMethod>(SortMethod.DATE_CREATED_DESC);
    const [isChangingPin, setIsChangingPin] = createSignal<number | null>(null);

    const sorter = (left: Course, right: Course): number => {
        // Pinned courses always first
        if (left.isPinned || right.isPinned) {
            return (+right.isPinned) - (+left.isPinned);
        }

        const method = sortMethod();
        switch (method) {
            case SortMethod.DATE_CREATED_DESC:
                return left.dateCreated === right.dateCreated ? 0
                    : left.dateCreated < right.dateCreated ? 1 : -1;
            case SortMethod.DATE_CREATED_ASC:
                return left.dateCreated === right.dateCreated ? 0
                    : left.dateCreated < right.dateCreated ? -1 : 1;
            case SortMethod.NAME_ASC:
                return left.name === right.name ? 0
                    : left.name < right.name ? -1 : 1;
            case SortMethod.NAME_DESC:
                return left.name === right.name ? 0
                    : left.name < right.name ? 1 : -1;
            default:
                return 0;
        }
    };

    const sortedCourses = createMemo(() => {
        return [...props.courses].sort(sorter);
    });

    const getRole = (courseId: number): string => {
        const roles = props.user.roles();
        for (let role of roles) {
            if (role.courseId() === courseId) {
                return role.name();
            }
        }
        return 'No Role';
    };

    const changePinStatus = async (course: Course) => {
        setIsChangingPin(course.id);
        try {
            const response = await ajax_post('courses/pin_course', {
                course_id: course.id,
                pin_status: !course.isPinned
            });
            
            if (response.success) {
                course.isPinned = !course.isPinned;
                if (response.updatedSettings) {
                    course.settings = response.updatedSettings;
                }
            } else {
                console.error(response);
                alert('Failed to set pin status: ' + response.message);
            }
        } catch (error) {
            console.error(error);
            alert('Failed to set pin status');
        } finally {
            setIsChangingPin(null);
        }
    };

    return (
        <div class="course-list">
            <div class="d-flex justify-content-between align-items-center mb-3">
                <h3>Courses</h3>
                <div class="float-right">
                    <label for={`sort-select-${props.label}`}>Sort by:</label>
                    <select
                        id={`sort-select-${props.label}`}
                        name={`sort-select-${props.label}`}
                        class="form-control form-control-sm d-inline-block w-auto ml-2"
                        value={sortMethod()}
                        onChange={(e) => setSortMethod(e.target.value as SortMethod)}
                    >
                        <option value={SortMethod.DATE_CREATED_DESC}>Most Recently Created</option>
                        <option value={SortMethod.DATE_CREATED_ASC}>Oldest Created</option>
                        <option value={SortMethod.NAME_ASC}>Name Ascending</option>
                        <option value={SortMethod.NAME_DESC}>Name Descending</option>
                    </select>
                </div>
            </div>

            <ul class="list-unstyled">
                <For each={sortedCourses()}>
                    {(course) => (
                        <li class="media mt-2 border-bottom pb-2">
                            <a href={`/courses/${course.id}`} class="btn btn-primary mr-3">
                                <span class="fas fa-eye"></span> Open
                            </a>
                            <div class="media-body">
                                <div class="d-flex w-100 justify-content-between">
                                    <h5 class="mb-1">{course.name}</h5>
                                    <span
                                        class={`fa-star align-right clickable ${course.isPinned ? 'fas' : 'far'}`}
                                        onClick={() => changePinStatus(course)}
                                        style={{ opacity: isChangingPin() === course.id ? 0.5 : 1 }}
                                        title={course.isPinned ? 'Unpin course' : 'Pin course'}
                                    ></span>
                                </div>
                                <p class="mb-1">
                                    <small class="text-muted">{course.prettyDateCreated}</small><br />
                                    Role: <span class="text-capitalize">{getRole(course.id)}</span>
                                </p>
                                <Show when={course.url}>
                                    <small class="text-muted">
                                        Course URL: <code>{course.url}</code>
                                        {course.service && course.service !== 'native' && <>, </>}
                                    </small>
                                </Show>
                                <Show when={course.service && course.service !== 'native'}>
                                    <small class="text-muted">
                                        LMS: <span>{course.service}</span>,
                                    </small>
                                </Show>
                                <small class="text-muted">
                                    {' '}Course ID: <span>{course.id}</span>
                                </small>
                            </div>
                        </li>
                    )}
                </For>
            </ul>

            <Show when={props.courses.length === 0}>
                <p class="text-muted">No courses found.</p>
            </Show>
        </div>
    );
};
