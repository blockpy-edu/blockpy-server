import enum
from strenum import StrEnum

class SubmissionMetrics(StrEnum):
    """
    Enumeration of various metrics tracked for submissions.
    """
    # Time tracking
    #: Sum of timestamps when the user was actively editing, can be used to compute average edit time
    total_edit_time = "total_edit_time"
    #: Count of times that the user made edits
    total_edits = "total_edits"
    #: Sum of timestamps when the user was attempting to run code, can be used to compute average attempt time
    total_intervention_time = "total_intervention_time"
    #: Count of times that the user was attempting to run code
    total_interventions = "total_interventions"
    #: Sum of time deltas (threshold=10s) between events, representing total time spent on the submission
    total_time_spent = "total_time_spent"
    #: Sum of time deltas between read events, representing total time spent reading the assignment
    total_read_time = "total_read_time"
    #: Sum of time deltas for read events, but only counting if they moved
    total_active_read_time = "total_active_read_time"
    #: Sum of time durations from watch-related events, representing total watch time
    total_watch_time = "total_watch_time"
    # Editing related events
    #: Count of times the user pasted content into the editor
    editing_pastes = "pastes"
    #: Max of number of emoji characters across all their edits
    editing_emojis = "emojis"
    #: Tabbed away from the environment
    window_visibility_changes = "window_visibility_changes"
    # Feedback related events
    #: Count of number of times a feedback event was generated
    feedback_total = "feedback_total"
    #: Count of number of times an attempt resulted in a syntax error
    feedback_syntax_errors = "feedback_syntax_errors"
    #: Count of number of times an attempt resulted in runtime errors
    feedback_runtime_errors = "feedback_runtime_errors"
    #: Count of total number of assertions were tested in each attempt
    feedback_assertion_counts = "feedback_assertion_counts"
    #: Count of total number of successful assertions in each attempt
    feedback_assertion_successes = "feedback_assertion_successes"
    #:
    feedback_assertion_feedbacks = "feedback_assertion_feedbacks"
    #:
    feedback_assertion_feedback_successes = "feedback_assertion_feedback_successes"