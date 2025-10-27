This document captures the schema of the quizzes.

Quizzes have two parts - the instructions and the feedback. Both parts have the `questions` field which maps to an object with Question IDs as the keys. The instructions have the stuff we present to students, and the feedback has the logic for checking their answer.

Examples:
* This file has two examples, one with all the question types and one with a big old question pool: https://gist.github.com/acbart/7b4b617d99a792c912b3f5fc88e18c8b

## Instructions JSON

The first file is the instructions, which has the settings, and the actual questions to show the user.

```json
{
    "settings": {
        ...
    },
    "pools": [
        ...
    ],
    "questions": {
        "QUESTION_ID1": {},
        "QUESTION_ID2": {},
        ...
    }
}
```

### Instruction Settings

The settings are fairly straightforward, so let's start with them.

* `feedbackType`: How soon students can see the feedback. There's supposed to be some other options, but I didn't finish them.
  * `"immediate"`: As soon as they submit the quiz, they can see feedback.
  * `"none"`: They can't see feedback at all.
  * `"summmary"`: When they are outside of the exam, they'll be able to see a limited summary bit of information about their performance.
* `attemptLimit`: How many times they can attempt the quiz. This is a number, with `-1` for infinite attempts (the default). 
* `coolDown`: How many minutes you must wait between attempts; -1 is no minutes and is the default. I doubt I even implemented this.
* `poolRandomness`: What kind of randomness to use for the question pools, which decides which questions students see.
  * `"ATTEMPT"`: Students see new questions every attempt (i.e., after every time they submit). Questions might be repeated across attempts, it's truly random what subset they get each time.
  * `"SEED"`: Each student will get a different random sample of questions, but the questions will be consistent across every attempt. This is useful if you want to have a quiz that students can take multiple times, but you want to make sure they get the same questions each time.
  * `"NONE"`: I... I don't know why I have this, but you can use this to make the pool exactly the same every time. Everyone gets the same random sample of questions, every time.
* `readingId`: The ID of the reading that this quiz is associated with. This is used to have the reading appear right before the quiz on the same page, which is the preferred style in the book now. This is optional, and if it's not present, the reading won't appear. It can be the BlockPy ID number, or the string url of the assignment (which is not the full HTTP url, just the last part like `bakery_for_loop_syntax_reading`).

### Question Pools

The pools are a list of question pools, which are used to decide which questions get logically grouped together into a pool. 

Remember, these objects are in a LIST.

* `"name"`: An optional string name for the pool. I usually name the questions stuff like `PoolName_1` and then the pool `PoolName`, using CapitalCamelCase.
* `"amount"`: The number of questions to select from this pool for each attempt.
* `"questions"`: A list of strings representing the IDs of the questions (eg.g., `["PoolName_1", "PoolName_2"]` or whatever you're calling them.)
* `"group"`: An optional string that allows multiple pools to "vary together". When pools share the same group name, they will use the same seed for question selection, ensuring their random choices are coordinated. This is useful for multi-question scenarios where you want to show related content (e.g., a code block in one pool and follow-up questions in another pool). Pools without a group field work independently as before.

### Questions Instructions

The `"questions"` field is an object mapping the unique IDs of the questions to their actual content. The IDs are strings, and the content is an object with the following fields:

* `"type"`: The type of question. This is a string, and can be one of the following:
  * `"matching_question"`: A matching question. The student will have multiple statements on the left, with a dropdown box on the right for possible answers.
  * `"true_false_question"`: A true/false question. The student can select either true or false (radio buttons). Usually these are easy to write but too easy to answer.
  * `"multiple_choice_question"`: A multiple choice question. The student can only select one answer (radio buttons).
  * `"multiple_answers_question"`: A multiple select question. The student can select multiple answers (check boxes).
  * `"multiple_dropdowns_question"`: A multiple dropdown question. The student will be presented with some `body` content that has dropdown boxes embedded, and they must choose the right answer. Fairly complicated to setup, but often very nice to use. Consider its tradeoffs with `matching_question` carefully; if you have a bunch of statements and the same possible answers for each one, that question is easier to setup. But this one is more flexible. The dropdowns will appear in the `body` whenever you have square brackets around an identifier (e.g., `[some_name]`), which should probably only have letters, numbers, and underscores. If you need to have actual square brackets in your text, then you need to use double brackets `[[` and `]]` instead for those parts (basically escapes the square brackets). (Pretty sure that's correct).
  * `"fill_in_multiple_blanks_question"`: A fill in the blank question. The student will be presented with some content that has blanks embedded, and they must fill in the right answer. Fairly complicated to setup, but often very nice to use. Similar to `short_answer`, just a bit more complicated. Also uses the square brackets and identifiers to mark where the input boxes appear, and you can use the double square brackets to escape them.
  * `"short_answer"`: A short answer question. The student can type in a short answer that can be automatically checked.
  * `"numerical_question"`: A numerical question. The student can type in a number that can be automatically checked, similar to short answer.
  * `"essay_question"`: An essay question. The student can type in a long answer that cannot be automatically checked.
* `body`: A string of markdown (and therefore also HTML) text that will be shown to the user as the text of the question. The system will turn the markdown into HTML before rendering, and handles a few different things like code fences. It also corrects file downloads to be relative to the current page, but I don't have the spoons to go figure out how that code actually works; hopefully you don't need to embed any downloadable files into your quiz. If necessary, you can always embed whatever HTML you want, but I strongly urge you to stick with Markdown. Also, you can use square brackets for `multiple_dropdowns_question` and `fill_in_multiple_blanks_question` to mark where the dropdowns and input boxes appear (see those types above).
* `"points"`: How many points this question is worth if the students gets it correct, for the quiz. Note that this does NOT affect the number of points for the entire assignment group, so if there are other quizzes or coding problems, this will not impact them. It's merely the weight of this question WITHIN the quiz vs other questions in the quiz. If it's not selected in the pool, then it will not impact the quiz at all.
* `"retainOrder"`: Boolean for whether the answers will retain their order, or if they will be randomized across questions and attempts. This is only relevant for `matching_question` and `multiple_dropdowns_question`.
* `"statements"`: A list of strings representing the statements for the question. This is only relevant for `matching_question`. Apparently, this is embedded as HTML, not Markdown. Not sure that was a wise decision. We might change it down the road if someone asks. Still, usually better to keep this as plain text as possible... Gosh, I'm really tempted to go change this. Put a TODO here about it.
* `"answers"`: Varies heavily depending on the question type, but basically the possibel answers for students. Some question types do not use this (`short_answer_question`, `numerical_question`, `essay_question`, `fill_in_multiple_blanks_question`, `true_false_question`), and some question types use it in different ways. See below for more details.
  * `"matching_question"`: A list of strings representing the possible answers for the question. These will be the dropdown options for the student to select from. The order of these will be randomized if `retainOrder` is false.
  * `"multiple_choice_question"`: A list of strings representing the possible answers for the question. These will be the radio button options for the student to select from. The order of these will NOT be randomized.
  * `"multiple_answers_question"`: A list of strings representing the possible answers for the question. These will be the checkbox options for the student to select from. The order of these will NOT be randomized.
  * `"multiple_dropdowns_question"`: An object mapping Answer IDs to list of strings representing the possible answers for the question part. These will be the dropdown options for the student to select from. The order of these will be randomized if `retainOrder` is false. Note that the Answer IDs must match the identifiers labeled in the body, or they will not be considered.

## Feedback JSON

The second file is the feedback, which has the logic for the questions. It "mirrors" the structure of the other file, at least in terms of question IDs mapped to objects.

```json
{
    "questions": {
        "QUESTION_ID1": {},
        "QUESTION_ID2": {},
        ...    
    },
}
```

The actual feedback and correct structure varies depending on the question type.

### `true_false_question`

* `"correct"`: A boolean for whether the statement is true or false. If true, then the student must select true to get the question correct. If false, then the student must select false to get the question correct.
* `"wrong"`: A string of HTML text that will be shown to the user as the feedback for the question if they get the wrong answer. I recommend keeping this as simple plain text. Perhaps someday we'll make it support Markdown instead, if someone ever asks.

### `matching_question`

* `"correct"`:  A list of strings in order of the correct answers. These values should match the exact order of the `statements` in the instructions, and their text content should exactly match the relevant answer in the `answers`. If the student matches the statement to the answer, then they get the question correct. If they do not, then they get the question wrong. Unlike Canvas, we award partial credit as `number correct / number of parts` with each statement weighted equally. A list of strings can be provided instead, in which case any of the possible answers will be accepted.
* `"feedback"`: A list of objects in order of the feedback for each statement. These values should match the exact order of the `statements` in the instructions. Each object is a mapping of a potential answer to the HTML feedback string presented if they pick that answer. So you can potentially provide feedback on every possible answer for every possible statement.

### `multiple_choice_question`

* `"correct"`: The exact string to compare the students' answer against. If the student selects this answer, then they get the question correct. If they do not, then they get the question wrong. This can also now be a list of possible answers, if you want to allow incorrect answers to be counted as correct.
* `"feedback"`: An object mapping potential answers to the HTML feedback string presented if they pick that answer. So you can potentially provide feedback on every possible answer.

### `multiple_answers_question`

* `"correct"`: A list of strings representing the correct answers. These values should match the exact text of the `answers` in the instructions that are correct. If the student selects all of these answers, then they get the question correct. If they do not, then they get the question wrong. Unlike Canvas, we award partial credit as `number correct / number of parts` with each answer weighted equally (so we treat them as if they were a series of true/false questions, basically).
* `"wrong_any"`: A string of HTML text that will be shown to the user as the feedback for the question if they get any of the answers wrong. There's noway to trigger certain feedback for getting certain parts wrong, although I could add that in if somebody wanted.

### `multiple_dropdowns_question`

* `"correct"`: An object mapping the Answer IDs to the correct answers. The Answer IDs must match the identifiers labeled in the body, or they will not be considered. If the student selects all of these answers, then they get the question correct. If they do not, then they get the question wrong. Unlike Canvas, we award partial credit as `number correct / number of parts` with each answer weighted equally (so we treat them as if they were a series of true/false questions, basically).
* `"wrong_any"`: A string of HTML text that will be shown to the user as the feedback for the question if they get any of the answers wrong. There's no way to trigger certain feedback for getting certain parts wrong, although I could add that in if somebody wanted.

### `short_answer_question` and `numerical_question`

These are treated exactly the same internally, except the `numerical_question` is rendered as a number. We should probably add a field for tolerance, but we barely ever use these questions anyway.

There's two different options for how to check correctness: exact and regex. You can only have one.

* `"correct_exact"` (also can use `correct`): This is the simpler version, but despite its name it actually is a little bit more flexible than exact: it ignores whitespace at the beginning and end of the student's text. More importantly, it can be expressed in two different ways:
  * A string: If you provide a string, then the student's answer must exactly match that string, ignoring whitespace at the beginning and end.
  * A list of strings: If you provide a list of strings, then the student's answer must exactly match one of those strings, ignoring whitespace at the beginning and end.
* `"correct_regex"`: A list of strings containing regular expressions, that will be checked one by one against the student's text. If any match, the answer is correct. If none match, the answer is wrong.

You also have a choice for the feedback here:

* `wrong_any`: A string of HTML text that will be shown to the user as the feedback for the question if they get any of the answers wrong. When provided, this will be used if there isn't more specific feedback provided using the `"feedback"` field.
* `"feedback"`: An object mapping potential answers to the HTML feedback string presented if they pick that answer. So you can potentially provide feedback on every possible answer. Note that the Regex feedback matches correctly, but the `correct` does not use its flexible string matching (it uses exact string matching). We could probably fix that too if someone asked.

### `fill_in_multiple_blanks_question`

This works exactly the same as `short_answer_question` EXCEPT that the inner structure for the `"correct_exact"` and `"correct_regex"` fields are objects mapping the Answer IDs to the strings or lists of strings. The Answer IDs must match the identifiers labeled in the body, or they will not be considered. You cannot mix and match the two types of correctness checking - you either use `"correct_exact"` or `"correct_regex"` for all of them.

Partial credit is calculated the same as for other kinds of multi-part questions: `number correct / number of parts` with each answer weighted equally.

The feedback is more limited here, with only `wrong_any` supported. We could probably add more if someone asked.

### `text_only_question` and `essay_question`

Not surprisingly for the `text_only_question`, but surprising for the `essay_question`, there is no feedback to specify here. The answer will always be considered correct and they get the full points each time. Usually you leave these as zero point questions.

We could probably make it so that we give zero points for leaving it blank, but that'll probably just encourage people to write in gibberish. So I'm not sure it's worth it.
