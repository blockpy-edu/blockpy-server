/**
 * Test fixture: Simple multiple choice quiz
 * Scenario: Basic quiz with 3 multiple choice questions
 */

import { QuizData, QuizQuestionType, QuizFeedbackType, QuizPoolRandomness } from '../../src/components/quizzes/types';

export const simpleMultipleChoiceQuiz: QuizData = {
  assignmentId: 201,
  courseId: 1,
  userId: 1,
  instructions: {
    settings: {
      attemptLimit: 2,
      coolDown: -1,
      feedbackType: QuizFeedbackType.IMMEDIATE,
      questionsPerPage: -1,
      poolRandomness: QuizPoolRandomness.SEED,
      readingId: null
    },
    pools: [],
    questions: {
      'q1': {
        id: 'q1',
        type: QuizQuestionType.multiple_choice_question,
        body: '<p>What is 2 + 2?</p>',
        points: 1,
        answers: ['3', '4', '5', '6']
      },
      'q2': {
        id: 'q2',
        type: QuizQuestionType.multiple_choice_question,
        body: '<p>Which programming language is this course about?</p>',
        points: 1,
        answers: ['Java', 'Python', 'C++', 'JavaScript']
      },
      'q3': {
        id: 'q3',
        type: QuizQuestionType.multiple_choice_question,
        body: '<p>What does <code>print("Hello")</code> output?</p>',
        points: 1,
        answers: ['Hello', '"Hello"', 'print("Hello")', 'Error']
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

export const completedMultipleChoiceQuiz: QuizData = {
  ...simpleMultipleChoiceQuiz,
  submission: {
    studentAnswers: {
      'q1': '4',
      'q2': 'Python',
      'q3': 'Hello'
    },
    attempt: {
      attempting: false,
      count: 1,
      mulligans: 0
    },
    feedback: {
      'q1': {
        correct: true,
        message: 'Correct! 2 + 2 = 4',
        score: 1
      },
      'q2': {
        correct: true,
        message: 'Correct! This course teaches Python.',
        score: 1
      },
      'q3': {
        correct: true,
        message: 'Correct! print() outputs the text without quotes.',
        score: 1
      }
    }
  }
};
