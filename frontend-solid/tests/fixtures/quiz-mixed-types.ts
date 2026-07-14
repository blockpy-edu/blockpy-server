/**
 * Test fixture: Mixed question types quiz
 * Scenario: Quiz with different question types (true/false, short answer, multiple answers)
 */

import { QuizData, QuizQuestionType, QuizFeedbackType, QuizPoolRandomness } from '../../src/components/quizzes/types';

export const mixedQuestionTypesQuiz: QuizData = {
  assignmentId: 202,
  courseId: 1,
  userId: 2,
  instructions: {
    settings: {
      attemptLimit: 3,
      coolDown: -1,
      feedbackType: QuizFeedbackType.IMMEDIATE,
      questionsPerPage: -1,
      poolRandomness: QuizPoolRandomness.ATTEMPT,
      readingId: null
    },
    pools: [],
    questions: {
      'tf1': {
        id: 'tf1',
        type: QuizQuestionType.true_false_question,
        body: '<p>Python is a compiled language.</p>',
        points: 1
      },
      'sa1': {
        id: 'sa1',
        type: QuizQuestionType.short_answer_question,
        body: '<p>What keyword is used to define a function in Python?</p>',
        points: 1
      },
      'ma1': {
        id: 'ma1',
        type: QuizQuestionType.multiple_answers_question,
        body: '<p>Which of the following are valid Python data types? (Select all that apply)</p>',
        points: 2,
        answers: ['int', 'str', 'boolean', 'char', 'list', 'array']
      },
      'tf2': {
        id: 'tf2',
        type: QuizQuestionType.true_false_question,
        body: '<p>Variables in Python must be declared with their type.</p>',
        points: 1
      }
    }
  },
  submission: {
    studentAnswers: {},
    attempt: {
      attempting: false,
      count: 0,
      mulligans: 0
    },
    feedback: {}
  }
};

export const attemptingMixedQuiz: QuizData = {
  ...mixedQuestionTypesQuiz,
  submission: {
    studentAnswers: {
      'tf1': false,
      'sa1': 'def'
    },
    attempt: {
      attempting: true,
      count: 0,
      mulligans: 0
    },
    feedback: {}
  }
};

export const completedMixedQuiz: QuizData = {
  ...mixedQuestionTypesQuiz,
  submission: {
    studentAnswers: {
      'tf1': false,
      'sa1': 'def',
      'ma1': ['int', 'str', 'list'],
      'tf2': false
    },
    attempt: {
      attempting: false,
      count: 1,
      mulligans: 0
    },
    feedback: {
      'tf1': {
        correct: true,
        message: 'Correct! Python is an interpreted language.',
        score: 1
      },
      'sa1': {
        correct: true,
        message: 'Correct! The <code>def</code> keyword is used to define functions.',
        score: 1
      },
      'ma1': {
        correct: true,
        message: 'Correct! int, str, and list are all valid Python data types.',
        score: 2
      },
      'tf2': {
        correct: true,
        message: 'Correct! Python uses dynamic typing.',
        score: 1
      }
    }
  }
};
