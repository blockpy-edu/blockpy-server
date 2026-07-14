/**
 * SubmissionHistory - SolidJS component for displaying submission history
 */

import { createSignal, createMemo, For, Show } from 'solid-js';
import { Log, LogJson } from '../../models/log';
import { User } from '../../models/user';
import { Assignment } from '../../models/assignment';
import { Submission, SubmissionJson } from '../../models/submission';
import { ajax_post } from '../../services/ajax';
import { SubmissionState, WatchMode, FeedbackMode } from './SubmissionState';
import { prettyPrintDate, prettyPrintTime } from '../../utilities/dates';
import { REMAP_EVENT_TYPES } from '../../models/log';
import './SubmissionHistory.css';

interface SubmissionHistoryProps {
  user: User;
  assignment: Assignment;
  submission?: Submission;
  defaultWatchMode?: WatchMode;
  grouping?: string;
}

export function SubmissionHistory(props: SubmissionHistoryProps) {
  const [states, setStates] = createSignal<SubmissionState[]>([]);
  const [watchMode, setWatchMode] = createSignal<WatchMode>(
    props.defaultWatchMode || WatchMode.SUMMARY
  );
  const [feedbackMode, setFeedbackMode] = createSignal<FeedbackMode>(FeedbackMode.BOTH);
  const [currentStateIndex, setCurrentStateIndex] = createSignal<number>(0);
  const [submission, setSubmission] = createSignal<Submission | undefined>(props.submission);

  const isVcrActive = createMemo(() => watchMode() !== WatchMode.SUMMARY);
  const isSummary = createMemo(() => watchMode() === WatchMode.SUMMARY);
  const isFull = createMemo(() => watchMode() === WatchMode.FULL);

  const currentState = createMemo(() => {
    const statesList = states();
    if (statesList.length > 0) {
      if (watchMode() !== WatchMode.SUMMARY) {
        const index = currentStateIndex();
        return statesList[index < 0 ? statesList.length + index : index];
      } else {
        return statesList[statesList.length - 1];
      }
    }
    return null;
  });

  const getWatchModeClass = createMemo(() => {
    switch (watchMode()) {
      case WatchMode.SUMMARY:
        return "fa-eye";
      case WatchMode.FULL:
        return "fa-eye-slash";
      default:
        return "fa-eye";
    }
  });

  function addLogs(logs: Log[]) {
    const newStates: SubmissionState[] = [];
    let latestState: SubmissionState | null = 
      states().length > 0 ? states()[states().length - 1] : null;

    for (const log of logs) {
      const nextState = new SubmissionState(latestState, log);
      newStates.push(nextState);
      latestState = nextState;
    }

    setStates([...states(), ...newStates]);
  }

  async function reload() {
    const sub = submission();
    if (!sub) return;

    try {
      const data = await ajax_post<{
        success: boolean;
        history: LogJson[];
        submissions: SubmissionJson[];
      }>('blockpy/load_history', {
        assignment_id: sub.assignmentId(),
        course_id: sub.courseId(),
        user_id: sub.userId(),
        with_submission: true
      });

      if (data.success) {
        const currentStates = states();
        const latestLogId = currentStates.length > 0 
          ? currentStates[currentStates.length - 1].log?.id || -1 
          : -1;
        
        const newLogs = data.history
          .filter(log => latestLogId < log.id)
          .map(log => new Log(log));
        
        addLogs(newLogs);

        if (data.submissions.length > 0) {
          const sub = submission();
          if (sub) {
            sub.fromJson(data.submissions[0]);
            setSubmission(sub);
          }
        }
      }
    } catch (error) {
      console.error('Failed to reload history:', error);
    }
  }

  function switchWatchMode() {
    if (watchMode() === WatchMode.SUMMARY) {
      setWatchMode(WatchMode.FULL);
      setCurrentStateIndex(states().length - 1);
    } else {
      setWatchMode(WatchMode.SUMMARY);
    }
  }

  function switchFeedbackMode() {
    const current = feedbackMode();
    switch (current) {
      case FeedbackMode.FEEDBACK:
        setFeedbackMode(FeedbackMode.SYSTEM);
        break;
      case FeedbackMode.SYSTEM:
        setFeedbackMode(FeedbackMode.BOTH);
        break;
      case FeedbackMode.BOTH:
        setFeedbackMode(FeedbackMode.HIDE);
        break;
      case FeedbackMode.HIDE:
        setFeedbackMode(FeedbackMode.FEEDBACK);
        break;
    }
  }

  function moveToStart() {
    setCurrentStateIndex(0);
  }

  function moveToBack() {
    setCurrentStateIndex(Math.max(0, currentStateIndex() - 1));
  }

  function seekToBack() {
    let index = currentStateIndex();
    const statesList = states();
    
    do {
      index -= 1;
    } while (index > 0 && statesList[index]?.log?.isEditEvent());
    
    setCurrentStateIndex(index);
  }

  function moveToNext() {
    setCurrentStateIndex(Math.min(states().length - 1, currentStateIndex() + 1));
  }

  function seekToNext() {
    let index = currentStateIndex();
    const statesList = states();
    
    do {
      index += 1;
    } while (index < statesList.length - 1 && statesList[index]?.log?.isEditEvent());
    
    setCurrentStateIndex(index);
  }

  function moveToMostRecent() {
    setCurrentStateIndex(states().length - 1);
  }

  return (
    <div>
      <Show when={props.grouping !== 'None'}>
        <h4>{props.grouping === 'User' ? props.user.title() : props.assignment.title()}</h4>
      </Show>

      <Show when={states().length > 0}>
        <div class="row">
          <div class="col-md-6">
            <div>
              <strong>User:</strong> {props.user.title()}
            </div>
            <div>
              <strong>Assignment:</strong> {props.assignment.title()}
            </div>
            <Show when={currentState()}>
              {(state) => (
                <>
                  <div>
                    Score: {state().completed ? 'Correct' : 'Incomplete'} ({state().score})
                  </div>
                </>
              )}
            </Show>
          </div>
          
          <div class="col-md-6">
            <Show when={currentState()}>
              {(state) => (
                <>
                  <div>Last Logged Event: {state().getPrettyTime()}</div>
                  <div>Last Edited: {state().getPrettyLastEdit(watchMode())}</div>
                  <div>Last Ran: {state().getPrettyLastRan(watchMode())}</div>
                  <div>Last Opened: {state().getPrettyLastOpened(watchMode())}</div>
                </>
              )}
            </Show>
          </div>

          <div class="col-md-12">
            <SubmissionHistoryVCR 
              watchMode={watchMode()}
              isVcrActive={isVcrActive()}
              getWatchModeClass={getWatchModeClass()}
              currentStateIndex={currentStateIndex()}
              statesLength={states().length}
              onSwitchWatchMode={switchWatchMode}
              onReload={reload}
              onMoveToStart={moveToStart}
              onSeekToBack={seekToBack}
              onMoveToBack={moveToBack}
              onMoveToNext={moveToNext}
              onSeekToNext={seekToNext}
              onMoveToMostRecent={moveToMostRecent}
              onStateIndexChange={setCurrentStateIndex}
              states={states()}
              userId={props.user.id}
              assignmentId={props.assignment.id}
            />
          </div>

          <Show when={!isSummary() && currentState()}>
            {(state) => (
              <div 
                class="mt-2" 
                classList={{
                  'col-md-6': feedbackMode() !== FeedbackMode.HIDE,
                  'col-md-11': feedbackMode() === FeedbackMode.HIDE
                }}
              >
                <pre class="python-code-block">
                  <code class="python" style="height: 200px; overflow: scroll">
                    {state().code}
                  </code>
                </pre>
              </div>
            )}
          </Show>

          <Show when={isFull() && currentState()}>
            {(state) => (
              <div 
                class="mt-2"
                classList={{
                  'col-md-6': feedbackMode() !== FeedbackMode.HIDE,
                  'col-md-1': feedbackMode() === FeedbackMode.HIDE
                }}
              >
                <button 
                  class="float-right btn btn-outline-secondary btn-sm"
                  onClick={switchFeedbackMode}
                >
                  {feedbackMode()}
                </button>
                <Show when={feedbackMode() === FeedbackMode.FEEDBACK || feedbackMode() === FeedbackMode.BOTH}>
                  <div innerHTML={state().feedback} />
                </Show>
                <Show when={feedbackMode() === FeedbackMode.SYSTEM || feedbackMode() === FeedbackMode.BOTH}>
                  <div innerHTML={state().system} />
                </Show>
              </div>
            )}
          </Show>
        </div>
      </Show>

      <Show when={states().length === 0}>
        <div class="row">
          <div class="col-md-6">
            <div>
              <strong>User:</strong> {props.user.title()}
            </div>
            <div>
              <strong>Assignment:</strong> {props.assignment.title()}
            </div>
            <div>Not yet started!</div>
          </div>
        </div>
      </Show>
    </div>
  );
}

interface VCRProps {
  watchMode: WatchMode;
  isVcrActive: boolean;
  getWatchModeClass: string;
  currentStateIndex: number;
  statesLength: number;
  onSwitchWatchMode: () => void;
  onReload: () => void;
  onMoveToStart: () => void;
  onSeekToBack: () => void;
  onMoveToBack: () => void;
  onMoveToNext: () => void;
  onSeekToNext: () => void;
  onMoveToMostRecent: () => void;
  onStateIndexChange: (index: number) => void;
  states: SubmissionState[];
  userId: number;
  assignmentId: number;
}

function SubmissionHistoryVCR(props: VCRProps) {
  return (
    <form class="form-inline">
      <button 
        class="btn btn-outline-secondary mr-2 btn-sm" 
        type="button"
        onClick={props.onSwitchWatchMode}
      >
        <span class={`fas ${props.getWatchModeClass}`}></span>
      </button>
      
      <button 
        class="btn btn-outline-secondary mr-2 btn-sm"
        type="button"
        onClick={props.onReload}
      >
        <span class="fas fa-sync"></span> Sync
      </button>

      <Show when={props.isVcrActive}>
        <button 
          class="btn btn-outline-secondary mr-2 btn-sm" 
          type="button"
          onClick={props.onMoveToStart}
        >
          <span class='fas fa-step-backward'></span> Start
        </button>
        
        <button 
          class="btn btn-outline-secondary mr-2 btn-sm" 
          type="button"
          onClick={props.onSeekToBack}
        >
          <span class='fas fa-fast-backward'></span>
        </button>
        
        <button 
          class="btn btn-outline-secondary mr-2 btn-sm" 
          type="button"
          onClick={props.onMoveToBack}
        >
          <span class='fas fa-backward'></span> Back
        </button>

        <select 
          class="history-select form-control custom-select mr-2 custom-select-sm"
          value={props.currentStateIndex}
          onChange={(e) => props.onStateIndexChange(parseInt(e.currentTarget.value))}
          id={`history-select-${props.userId}-${props.assignmentId}`}
        >
          <For each={props.states}>
            {(state, index) => {
              const log = state.log;
              if (!log) return null;
              
              const when = log.clientTimestamp() || log.dateCreated() || log.when();
              const eventType = REMAP_EVENT_TYPES[log.eventType()] || log.eventType();
              const displayed = `${prettyPrintTime(when)} - ${eventType}`;
              
              return <option value={index()}>{displayed}</option>;
            }}
          </For>
        </select>

        <button 
          class="btn btn-outline-secondary mr-2 btn-sm" 
          type="button"
          onClick={props.onMoveToNext}
        >
          <span class='fas fa-forward'></span> Next
        </button>
        
        <button 
          class="btn btn-outline-secondary mr-2 btn-sm" 
          type="button"
          onClick={props.onSeekToNext}
        >
          <span class='fas fa-fast-forward'></span>
        </button>
        
        <button 
          class="btn btn-outline-secondary mr-2 btn-sm" 
          type="button"
          onClick={props.onMoveToMostRecent}
        >
          <span class='fas fa-step-forward'></span> Most Recent
        </button>
      </Show>
    </form>
  );
}
