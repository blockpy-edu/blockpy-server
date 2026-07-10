import * as ko from 'knockout';
import {QuestionPool} from './quiz';

export const matchKeyInBrackets = (key: string) => new RegExp(`(?<!\\\))(\\[${key}\\])(?!\\()`);
export const SQUARE_BRACKETS = /(?<!\\)(\[.*?\]\]?)(?!\()/

export enum QuizQuestionTypes {
    multiple_choice_question="multiple_choice_question",
    multiple_answers_question="multiple_answers_question",
    true_false_question="true_false_question",
    text_only_question="text_only_question",
    matching_question="matching_question",
    multiple_dropdowns_question="multiple_dropdowns_question",
    short_answer_question="short_answer_question",
    fill_in_multiple_blanks_question="fill_in_multiple_blanks_question",

    calculated_question="calculated_question",
    essay_question="essay_question",
    file_upload_question="file_upload_question",

    numerical_question="numerical_question",
    likert_question="likert_question"
}

export const clearValue = (question: Question) => {
    switch (question.type) {
        case QuizQuestionTypes.multiple_answers_question:
            return question.student([]);
        case QuizQuestionTypes.matching_question:
            return question.student.map((v: any) => v(undefined));
        case QuizQuestionTypes.multiple_dropdowns_question:
        case QuizQuestionTypes.fill_in_multiple_blanks_question:
        case QuizQuestionTypes.likert_question:
            for (const key in question.student) {
                question.student[key]('');
            }
            return question.student;
        default:
            return question.student("");
    }
}

export const getDefaultValue = (question: Question, answer: any): any => {
    switch (question.type) {
        case QuizQuestionTypes.multiple_answers_question:
            return ko.observableArray(answer && answer.length ? answer: []);
        case QuizQuestionTypes.matching_question:
            return answer && answer.length
                ? question.statements.map((v: any, i: number) => ko.observable(answer[i]))
                : question.statements.map((v: any) => ko.observable(undefined));
        case QuizQuestionTypes.multiple_dropdowns_question:
            let mdqResult: {[key: string]: ko.Observable} = {};
            Object.entries(question.answers).forEach(([key, value])=> {
                mdqResult[key] = ko.observable(answer ? answer[key] || '' : '')
            });
            return mdqResult;
        case QuizQuestionTypes.fill_in_multiple_blanks_question:
            let fimbResult: {[key: string]: ko.Observable} = {};
            getBracketed(question.body).map((key: string) => {
                fimbResult[key] = ko.observable(answer ? answer[key] || '' : "")
                    .extend({ rateLimit: { method: "notifyWhenChangesStop", timeout: 400 } });
            });
            return fimbResult;
        case QuizQuestionTypes.likert_question:
            let likertResult: {[key: string]: ko.Observable} = {};
            (question.statements || []).forEach((_: any, i: number) => {
                const key = String(i);
                likertResult[key] = ko.observable(answer ? answer[key] || '' : '');
            });
            return likertResult;
        case QuizQuestionTypes.numerical_question:
        case QuizQuestionTypes.essay_question:
        case QuizQuestionTypes.short_answer_question:
            return ko.observable(answer || "")
                    .extend({ rateLimit: { method: "notifyWhenChangesStop", timeout: 400 } });
        default:
            return ko.observable(answer || "");
    }
}

export const getBracketed = (body: string): string[] => {
    return body.split(SQUARE_BRACKETS)
        .filter((part: string) => !(part.startsWith('[[') && part.endsWith(']]')))
        .filter((part: string) => part.startsWith('[') && part.endsWith(']'))
        .map((part: string) => part.slice(1, -1));
}

export const subscribeToStudent = (question: Question): ko.Observable[] => {
    ///console.log(question.id, question.student);
    switch (question.type) {
        case QuizQuestionTypes.matching_question:
            return question.student;
        case QuizQuestionTypes.multiple_dropdowns_question:
        case QuizQuestionTypes.fill_in_multiple_blanks_question:
        case QuizQuestionTypes.likert_question:
            return Object.values(question.student);
        case QuizQuestionTypes.multiple_answers_question:
        default:
            return [question.student];
    }
}

export const getValue = (question: Question): any => {
    switch (question.type) {
        case QuizQuestionTypes.matching_question:
            return question.student.map((value: ko.Observable) => value());
        case QuizQuestionTypes.multiple_dropdowns_question:
        case QuizQuestionTypes.fill_in_multiple_blanks_question:
        case QuizQuestionTypes.likert_question:
            let result: {[key: string]: string} = {};
            Object.entries(question.student).forEach(([key, value]: [string, ko.Observable])=> {
                result[key] = value();
            });
            return result;
        case QuizQuestionTypes.multiple_answers_question:
        default:
            return question.student();
    }
}

export interface Feedback {
    correct: boolean
    score: number
    message: string
    status: string
}

export interface Question {
    body: string
    id: string
    title: string
    type: string
    points: number
    student: any
    answers?: string[] | {[key: string]: string[]}
    statements?: string[]
    options?: string[]
    retainOrder?: boolean

    feedback: ko.Observable<Feedback>
    visible: ko.Observable<boolean>
    pool: ko.Observable<QuestionPool>
    editing: ko.Observable<boolean>
    rawBody: ko.Observable<string>
}