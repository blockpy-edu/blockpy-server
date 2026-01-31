import './services/plugins';
import "./models/model";
export {dateCreatedSorter} from "./models/model";

// Site wide utilities, available through frontend.*
export * from "./site/core";
export { generateUUID } from "./utilities/random";
export { getParameterByName } from "./utilities/urls";
export { prettyPrintDateTime, prettyPrintDateTimeString } from "./utilities/dates";

// Data models
export {AssignmentGroup} from "./models/assignment_group";
export {GroupList} from "./components/group_list";
export {User} from "./models/user";
export {Assignment} from "./models/assignment";

// Main server that coordinates data
export {Server} from "./services/server";

// Interfaces
export {Watcher} from "./components/watcher/watcher";
export {launchEditor} from "./services/editor";

// These interfaces are just new tags
import "./components/course_list";
import "./components/assignment_manager";
import "./components/quizzes/quizzer";
import "./components/reader/reader";
//import "./components/java";
import './components/kettle/kettle';
import './components/explanations/explain';
import "./components/review_interface";
import "./components/blockpy/blockpy_interface";
//import "./components/textbook";

import "./styles/test.css";