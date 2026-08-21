import {Server} from "../services/server";
import {Course} from "../models/course";
import {User} from "../models/user";
import * as ko from 'knockout';
import {AssignmentGroup} from "../models/assignment_group";
import {Assignment} from "../models/assignment";

export interface AssignmentManagerInterfaceJson {
    server: Server;
    course: Course;
    user: User;
}

export class AssignmentManagerInterface {
    server: Server;
    course: Course;
    user: User;

    assignments: KnockoutObservableArray<Assignment>;
    groups: KnockoutObservableArray<AssignmentGroup>;

    assignmentToGroup: Record<number, AssignmentGroup>;
    groupToAssignment: Record<number, Assignment>;

    constructor(params: AssignmentManagerInterfaceJson) {
        this.server = params.server;
        this.course = params.course;
        this.user = params.user;
        this.assignments = ko.observableArray<Assignment>([]);
        this.groups = ko.observableArray<AssignmentGroup>([]);
        this.server.assignmentStore.getAllAvailable({assignment_ids: "", course_id: this.course.id}).then((created: Assignment[]) => {
            this.assignments.push(...created);
            created.map(assignment => {
                if (assignment.group() != null) {
                    // TODO: Figure this all out
                }
            });
        });
    }

}


const NEW_ASSIGNMENT_MODAL = `<div class="modal fade" id="assignment-create" tabindex="-1" role="dialog" aria-labelledby="assignment-create-label">
  <div class="modal-dialog" role="document">
    <div class="modal-content">
      <div class="modal-header">
        <button type="button" class="close" data-dismiss="modal" aria-label="Close"><span aria-hidden="true">&times;</span></button>
        <h4 class="modal-title" id="assignment-create-label">Create Assignment</h4>
      </div>
      <div class="modal-body">
        <div class="form-group">
            <label for="assignment-name">Type:
            <select class="form-control" data-bind="value: createAssignmentType">
                <option>BlockPy</option>
                <option>Reading</option>
                <option value="quiz">Quiz Questions</option>
                <option>TypeScript</option>
                <option>Textbook</option>
                <option value="explain">Code Explanation</option>
                <option value="feedback">Feedback</option>
            </select></label>
        </div>
        <div class="form-group" data-bind="visible: createAssignmentType() != 'Maze'">
            <label for="assignment-name">Student-facing Name:
            <input type="text" class="form-control" id="assignment-name"
                   data-bind="value: createAssignmentName" placeholder="Day 1 - #1.1">
            </label>
        </div>
        <div class="form-group" data-bind="visible: createAssignmentType() != 'Maze'">
            <label for="assignment-url">Unique Internal URL:
            <input type="text" class="form-control" id="assignment-url"
                   data-bind="value: createAssignmentUrl" placeholder="assignment_url">
            </label>
        </div>
        <div class="form-group" data-bind="visible: createAssignmentType() == 'Maze'">
            <label for="assignment-name">Maze Level:
            <select class="form-control" data-bind="value: createAssignmentLevel">
                <option value='1'>Level 1</option>
                <option value='2'>Level 2</option>
                <option value='3'>Level 3</option>
                <option value='4'>Level 4</option>
                <option value='5'>Level 5</option>
                <option value='6'>Level 6</option>
                <option value='7'>Level 7</option>
                <option value='8'>Level 8</option>
                <option value='9'>Level 9</option>
                <option value='10'>Level 10</option>
            </select>
            </label>
        </div>
      </div>
      <div class="modal-footer">
        <button type="button" class="btn btn-outline-secondary" data-dismiss="modal">Cancel</button>
        <button type="button" class="btn btn-primary" data-bind="click: $root.addAssignment">Create</button>
      </div>
    </div>
  </div>
</div>

<div class="modal fade" id="group-create" tabindex="-1" role="dialog" aria-labelledby="group-create-label">
  <div class="modal-dialog" role="document">
    <div class="modal-content">
      <div class="modal-header">
        <button type="button" class="close" data-dismiss="modal" aria-label="Close"><span aria-hidden="true">&times;</span></button>
        <h4 class="modal-title" id="group-create-label">Create Assignment Group</h4>
      </div>
      <div class="modal-body">
        <div class="form-group">
            <label for="group-name">Name:
            <input type="text" class="form-control" id="group-name"
                   data-bind="value: createGroupName" placeholder="Day X - ">
            </label>
        </div>
          <div class="form-group">
            <label for="group-url">Internal Unique Url:
            <input type="text" class="form-control" id="group-url"
                   data-bind="value: createGroupUrl" placeholder="unique_group">
            </label>
        </div>
      </div>
      <div class="modal-footer">
        <button type="button" class="btn btn-outline-secondary" data-dismiss="modal">Cancel</button>
        <button type="button" class="btn btn-primary" data-bind="click: $root.addGroup">Create</button>
      </div>
    </div>
  </div>
</div>`;


export const ASSIGNMENT_MANAGER_HTML = `

Bulk edit assignments/groups

Then list the actual groups/assignments

Group by?

Sort by name, date, url, points

Yes/No: Show assignments used by this course

<div>
    <a href="#" data-toggle="modal" data-target="#assignment-create" class="btn btn-outline-secondary btn-sm">
        Create Assignment <span class="fas fa-plus" aria-hidden="true"></span></a>
    
    <a href="#" data-toggle="modal" data-target="#group-create" class="btn btn-outline-secondary btn-sm">
        Create Group <span class="fas fa-folder-plus" aria-hidden="true"></span></a>
    
    <a href="#" data-toggle="modal" data-target="#assignment-import" class="btn btn-outline-secondary btn-sm">
        Import from another course <span class="fas fa-file-import" aria-hidden="true"></span></a>
        
    <a href="#" data-toggle="modal" data-target="#assignment-upload" class="btn btn-outline-secondary btn-sm">
        Import from file <span class="fas fa-file-upload" aria-hidden="true"></span></a>
</div>

<table class="table table-condensed table-hover">
<caption>Assignments</caption>
<tbody>
   <!-- ko foreach: assignments -->
   <tr class='hover-movers-rows'>
        <td style='width: 25%'>
            <strong data-bind="text: title"></strong><br>
            <span data-bind="text: url" class="small"></span><br>
            <span data-bind="text: prettyDateModified, attr: {title: dateModified}"></span>
        </td>
        <td style='width: 42%'>
            <span data-bind="text: instructions"></span>
        </td>
        <td style='width: 16%'>
            <div class="mover-buttons btn-group">
              <button type="button" class="btn btn-outline-secondary btn-sm dropdown-toggle"
                      data-toggle="dropdown" aria-haspopup="true" aria-expanded="false">
                      Move Group<span class="caret"></span>
              </button>
              <div class="dropdown-menu dropdown-menu-right" data-bind="foreach: $parents.groups">
                  <a href="#" class="dropdown-item" data-bind="click: $root.moveMembership.bind($data, $parent, $parents[1]), text: name"></a>
              </div>
            </div>
        </td>
        <td style='width: 17%'>
            <div class="btn-group">
                <!-- Select button -->
                <a target="_blank" data-bind="attr: { href: editUrl }" class="btn btn-primary btn-sm">Edit</a>
                <!-- Dropdown -->
                <button type="button" class="btn btn-primary dropdown-toggle btn-sm" data-toggle="dropdown" aria-haspopup="true" aria-expanded="false">
                    <span class="caret"></span>
                    <span class="sr-only">Toggle Dropdown</span>
                </button>
                <!-- Extended buttons -->
                <div class="dropdown-menu">
                    <a class="dropdown-item" href="#" data-bind="click: null /*$root.removeAssignment.bind($data, $parent)*/">Delete</a>
                </div>
            </div>
        </td>
    </tr>
    <!-- /ko -->
</tbody>
</table>



`;

ko.components.register("assignment-manager", {
    viewModel: AssignmentManagerInterface,
    template: ASSIGNMENT_MANAGER_HTML
});

