/**
 * Question Groups
 *
 * Pure (Knockout-free) logic for deciding how a quiz's questions are laid out
 * for display. Questions can opt in to being rendered together as a single
 * "Question Group" grid by setting the same `group` string on each of them.
 *
 * A run of questions is grouped when every member:
 *   - is contiguous with the others in question order,
 *   - has the same non-empty `group` value,
 *   - is a `multiple_choice_question`,
 *   - has `horizontal: true`, and
 *   - has exactly the same `answers` list (same strings, same order).
 *
 * A run of one question is displayed as an ordinary question card. When a
 * shared `group` value is broken by a change in answers (or type/horizontal),
 * the run is split at each change and the resulting items carry a `warning`
 * so instructors can see why the group did not form.
 *
 * Grouping is purely presentational: the submission JSON, feedback, grading
 * and pools are untouched because answers are still stored per question id.
 */

import {Question, QuizQuestionTypes} from './questions';

export interface SingleDisplayItem {
    kind: 'single'
    question: Question
    /** 1-based display number */
    index: number
    /** e.g. "Question 3" */
    label: string
    /** Set when this question had a `group` value that could not be honoured */
    warning?: string
}

export interface GroupDisplayItem {
    kind: 'group'
    questions: Question[]
    /** The shared answers list (identical across all members) */
    answers: string[]
    group: string
    /** 1-based display number */
    index: number
    /** e.g. "Question Group 3" */
    label: string
    /** Set when a sibling with the same `group` value was split off */
    warning?: string
}

export type QuestionDisplayItem = SingleDisplayItem | GroupDisplayItem;

/** The `group` value of a question, or null when it does not opt in. */
export function getGroupName(question: Question): string | null {
    const group = question.group;
    if (typeof group !== 'string') {
        return null;
    }
    const trimmed = group.trim();
    return trimmed === '' ? null : trimmed;
}

/** Whether a question is even eligible to sit inside a group grid. */
export function isGroupable(question: Question): boolean {
    return question.type === QuizQuestionTypes.multiple_choice_question
        && !!question.horizontal
        && Array.isArray(question.answers);
}

function sameAnswers(a: Question, b: Question): boolean {
    const left = a.answers as string[];
    const right = b.answers as string[];
    if (!Array.isArray(left) || !Array.isArray(right) || left.length !== right.length) {
        return false;
    }
    return left.every((answer, i) => answer === right[i]);
}

/** Why two adjacent questions with the same group name cannot share a grid. */
function incompatibilityReason(a: Question, b: Question): string | null {
    if (a.type !== b.type) {
        return 'the questions have different types';
    }
    if (!!a.horizontal !== !!b.horizontal) {
        return 'not every question is horizontal';
    }
    if (!sameAnswers(a, b)) {
        return 'the questions have different answers';
    }
    return null;
}

/**
 * Partition an ordered list of questions into display items.
 *
 * The algorithm walks the questions once, extending the current run while the
 * next question has the same group name and is compatible with the previous
 * member. Runs of one collapse back into single items.
 */
export function buildDisplayItems(questions: Question[]): QuestionDisplayItem[] {
    const items: QuestionDisplayItem[] = [];
    // A pending run: group name, members, and the reason a sibling was split off
    let run: Question[] = [];
    let runGroup: string | null = null;
    let runWarning: string | undefined = undefined;

    const flush = () => {
        if (run.length === 0) {
            return;
        }
        const index = items.length + 1;
        if (run.length === 1) {
            items.push({
                kind: 'single',
                question: run[0],
                index,
                label: `Question ${index}`,
                warning: runWarning
            });
        } else {
            items.push({
                kind: 'group',
                questions: run,
                answers: run[0].answers as string[],
                group: runGroup,
                index,
                label: `Question Group ${index}`,
                warning: runWarning
            });
        }
        run = [];
        runGroup = null;
        runWarning = undefined;
    };

    for (const question of questions) {
        const group = getGroupName(question);
        if (group === null) {
            flush();
            items.push({
                kind: 'single',
                question,
                index: items.length + 1,
                label: `Question ${items.length + 1}`
            });
            continue;
        }
        if (run.length > 0 && runGroup === group) {
            const previous = run[run.length - 1];
            const reason = isGroupable(question) && isGroupable(previous)
                ? incompatibilityReason(previous, question)
                : 'only horizontal multiple choice questions can be grouped';
            if (reason === null) {
                run.push(question);
                continue;
            }
            // Same group name but incompatible: split here and warn both sides
            const warning = `Group "${group}" was split because ${reason}.`;
            runWarning = runWarning || warning;
            flush();
            run = [question];
            runGroup = group;
            runWarning = warning;
            continue;
        }
        // Different group name (or no current run): start a new run
        flush();
        run = [question];
        runGroup = group;
        runWarning = isGroupable(question)
            ? undefined
            : `Group "${group}" ignored because only horizontal multiple choice questions can be grouped.`;
    }
    flush();
    return items;
}
