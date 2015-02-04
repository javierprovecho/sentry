/** @jsx React.DOM */

var Reflux = require("reflux");

var AlertActions = require("../actions/alertActions");
var AggregateListActions = require('../actions/aggregateListActions');
var MemberListStore = require("../stores/memberListStore");
var utils = require("../utils");

var ERR_CHANGE_ASSIGNEE = 'Unable to change assignee. Please try again.';
var OK_SCHEDULE_DELETE = 'The selected events have been scheduled for deletion.';
var OK_SCHEDULE_MERGE = 'The selected events have been scheduled for merge.';

var AggregateListStore = Reflux.createStore({
  init() {
    this.items = [];
    this.statuses = {};
    this.pendingChanges = new utils.PendingChangeQueue();

    this.listenTo(AggregateListActions.update, this.onUpdate);
    this.listenTo(AggregateListActions.updateError, this.onUpdateError);
    this.listenTo(AggregateListActions.updateSuccess, this.onUpdateSuccess);
    this.listenTo(AggregateListActions.assignTo, this.onAssignTo);
    this.listenTo(AggregateListActions.assignToError, this.onAssignToError);
    this.listenTo(AggregateListActions.assignToSuccess, this.onAssignToSuccess);
  },

  // TODO(dcramer): this should actually come from an action of some sorts
  loadInitialData(items) {
    this.items = [];
    this.statuses = {};
    this.pendingChanges.clear();
    items.forEach(item => {
      this.items.push(item);
    });
    this.trigger(this.getAllItems());
  },

  addStatus(id, status) {
    if (typeof this.statuses[id] === 'undefined') {
      this.statuses[id] = {};
    }
    this.statuses[id][status] = true;
  },

  clearStatus(id, status) {
    if (typeof this.statuses[id] === 'undefined') {
      return;
    }
    this.statuses[id][status] = false;
  },

  hasStatus(item, status) {
    if (typeof this.statuses[id] === 'undefined') {
      return false;
    }
    return this.statuses[id][status] || false;
  },

  getItem(id) {
    var pendingForId = [];
    this.pendingChanges.forEach(change => {
      if (change.id === id) {
        pendingForId.push(change);
      }
    });

    for (var i = 0; i < this.items.length; i++) {
      if (this.items[i].id === id) {
        var rItem = this.items[i];
        if (pendingForId.length) {
          // copy the object so dirty state doesnt mutate original
          rItem = $.extend(true, {}, rItem);

          for (var c = 0; c < pendingForId.length; c++) {
            rItem = $.extend(true, rItem, pendingForId[c].params);
          }
        }
        return rItem;
      }
    }
  },

  getAllItems() {
    // regroup pending changes by their itemID
    var pendingById = {};
    this.pendingChanges.forEach(change => {
      if (typeof pendingById[change.id] === 'undefined') {
        pendingById[change.id] = [];
      }
      pendingById[change.id].push(change);
    });

    return this.items.map(item => {
      var rItem = item;
      if (typeof pendingById[item.id] !== 'undefined') {
        // copy the object so dirty state doesnt mutate original
        rItem = $.extend(true, {}, rItem);
        pendingById[item.id].forEach(change => {
          rItem = $.extend(true, rItem, change.params);
        });
      }
      return rItem;
    });
  },

  // re-fire bulk events as individual actions
  // XXX(dcramer): ideally we could do this as part of the actions API but
  // there's no way for us to know "all events" for us to actually fire the action
  // on each individual event when its a global action (i.e. id-less)
  onUpdate(changeId, itemIds, data){
    if (typeof itemIds === 'undefined') this.items.map(item => item.id);
    itemIds.forEach(item => {
      this.addStatus(itemId, 'update');
      this.pendingChanges.push(changeId, itemId, data);
    });
    this.trigger(this.getAllItems());
  },

  onUpdateError(changeId, itemIds, error){
    this.pendingChanges.remove(changeId);
    itemIds.forEach(itemId => {
      this.clearStatus(itemId, 'update');
    });
    this.trigger(this.getAllItems());
  },

  onUpdateSuccess(changeId, itemIds, response){
    if (typeof itemIds === 'undefined') this.items.map(item => item.id);
    this.items.forEach(item => {
      if (itemIds.indexOf(item.id) !== 1) {
        $.extend(true, item, response);
        this.clearStatus(item.id, 'update');
      }
    });
    this.pendingChanges.remove(changeId);
    this.trigger(this.getAllItems());
  },

  onAssignTo(id, email) {
    this.addStatus(itemId, 'assignTo');
  },

  // TODO(dcramer): This is not really the best place for this
  onAssignToError(id, email) {
    this.clearStatus(itemId, 'assignTo');
    AlertActions.addAlert(ERR_CHANGE_ASSIGNEE, 'error');
  },

  onAssignToSuccess(id, email) {
    var item = this.items.get(id);
    if (!item) {
      return;
    }
    if (email === '') {
      item.assignedTo = '';
    } else {
      var member = MemberListStore.getByEmail(email);
      if (member) {
        item.assignedTo = member;
      }
    }
    this.clearStatus(itemId, 'assignTo');
    this.trigger(this.getAllItems());
  },

  onDeleteCompleted(changeId, itemIds) {
    itemIds.forEach(itemId => {
      this.clearStatus(itemId, 'delete');
    });
    AlertActions.addAlert(OK_SCHEDULE_DELETE, 'success');
  },

  onMergeCompleted(changeId, itemIds) {
    itemIds.forEach(itemId => {
      this.clearStatus(itemId, 'merge');
    });
    AlertActions.addAlert(OK_SCHEDULE_MERGE, 'success');
  }
});

module.exports = AggregateListStore;
