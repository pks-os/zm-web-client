/*
 * ***** BEGIN LICENSE BLOCK *****
 * 
 * Zimbra Collaboration Suite Web Client
 * Copyright (C) 2005, 2006, 2007 Zimbra, Inc.
 * 
 * The contents of this file are subject to the Yahoo! Public License
 * Version 1.0 ("License"); you may not use this file except in
 * compliance with the License.  You may obtain a copy of the License at
 * http://www.zimbra.com/license.
 * 
 * Software distributed under the License is distributed on an "AS IS"
 * basis, WITHOUT WARRANTY OF ANY KIND, either express or implied.
 * 
 * ***** END LICENSE BLOCK *****
 */

/**
 * Creates a new appointment controller to manage appointment creation/editing.
 * @constructor
 * @class
 * This class manages appointment creation/editing.
 *
 * @author Parag Shah
 *
 * @param container	[DwtComposite]	the containing element
 * @param app		[ZmCalendarApp]	a handle to the calendar application
 */
ZmApptComposeController = function(container, app) {

	ZmCalItemComposeController.call(this, container, app);

	this._addedAttendees = [];
	this._removedAttendees = [];
	this._kbMgr = appCtxt.getKeyboardMgr();

	// preload compose view for faster loading
	this.initComposeView(true);
};

ZmApptComposeController.prototype = new ZmCalItemComposeController;
ZmApptComposeController.prototype.constructor = ZmApptComposeController;

ZmApptComposeController.prototype.toString =
function() {
	return "ZmApptComposeController";
};

// Public methods

ZmApptComposeController.prototype.show =
function(calItem, mode, isDirty) {
	ZmCalItemComposeController.prototype.show.call(this, calItem, mode, isDirty);

	this._addedAttendees.length = this._removedAttendees.length = 0;
	this._setComposeTabGroup();

	if (appCtxt.numVisibleAccounts > 1) {
		appCtxt.getApp(ZmApp.CALENDAR).getOverviewPanelContent().setEnabled(false);
	}
};

ZmApptComposeController.prototype.saveCalItem =
function(attId) {
	var appt = this._composeView.getAppt(attId);
	if (appt) {
		
		if (this._invalidAttendees && this._invalidAttendees.length > 0) {
			var dlg = appCtxt.getYesNoMsgDialog();
			dlg.registerCallback(DwtDialog.YES_BUTTON, this._clearInvalidAttendeesCallback, this, [appt, attId, dlg]);
			var msg = AjxMessageFormat.format(ZmMsg.compBadAttendees, this._invalidAttendees.join(","));
			dlg.setMessage(msg, DwtMessageDialog.WARNING_STYLE);
			dlg.popup();
			return false;
		}
		
		var origAttendees = appt.origAttendees;						// bug fix #4160
		if (origAttendees && origAttendees.length > 0 && 			// make sure we're not u/l'ing a file
			attId == null) 											// make sure we are editing an existing appt w/ attendees
		{
			if (!this._composeView.getApptTab().isDirty(true)) {	// make sure other fields (besides attendees field) have not changed
				var attendees = appt.getAttendees(ZmCalBaseItem.PERSON);
				if (attendees.length > 0) {
					// check whether organizer has added/removed any attendees
					if (this._attendeesUpdated(appt, attId, attendees, origAttendees))
						return false;
				}
			}

			// check whether moving appt from local to remote folder with attendees
			var cc = AjxDispatcher.run("GetCalController");
			if (cc.isMovingBetwAccounts(appt, appt.__newFolderId)) {
				var dlg = appCtxt.getYesNoMsgDialog();
				dlg.registerCallback(DwtDialog.YES_BUTTON, this._changeOrgCallback, this, [appt, attId, dlg]);
				var newFolder = appCtxt.getById(appt.__newFolderId);
				var newOrg = newFolder ? newFolder.getOwner() : null;
				if (newOrg) {
					var msg = AjxMessageFormat.format(ZmMsg.orgChange, newOrg);
					dlg.setMessage(msg, DwtMessageDialog.WARNING_STYLE);
					dlg.popup();
					return false;
				}
			}
		}
		// otherwise, just save the appointment
		this._saveCalItemFoRealz(appt, attId);
	}
	return true;
};

ZmApptComposeController.prototype.getFreeBusyInfo = 
function(startTime, endTime, emailList, callback, errorCallback, noBusyOverlay) {
	var soapDoc = AjxSoapDoc.create("GetFreeBusyRequest", "urn:zimbraMail");
	soapDoc.setMethodAttribute("s", startTime);
	soapDoc.setMethodAttribute("e", endTime);
	soapDoc.setMethodAttribute("uid", emailList);

	return appCtxt.getAppController().sendRequest({soapDoc:soapDoc, asyncMode:true, callback:callback,
												   errorCallback:errorCallback, noBusyOverlay:noBusyOverlay});
};

ZmApptComposeController.prototype._createComposeView =
function() {
	return (new ZmApptComposeView(this._container, null, this._app, this));
};

ZmApptComposeController.prototype._setComposeTabGroup =
function(setFocus) {
	DBG.println(AjxDebug.DBG2, "_setComposeTabGroup");
	var tg = this._createTabGroup();
	var rootTg = appCtxt.getRootTabGroup();
	tg.newParent(rootTg);
	tg.addMember(this._toolbar);
	var tabView = this._composeView.getTabView(this._composeView.getCurrentTab());
	tabView._addTabGroupMembers(tg);
	
	var focusItem = tabView._savedFocusMember || tabView._getDefaultFocusItem() || tg.getFirstMember(true);
	var ta = new AjxTimedAction(this, this._setFocus, [focusItem, !setFocus]);
	AjxTimedAction.scheduleAction(ta, 10);
};

ZmApptComposeController.prototype.getKeyMapName =
function() {
	return "ZmApptComposeController";
};

ZmApptComposeController.prototype.handleKeyAction =
function(actionCode) {
	if (actionCode == ZmKeyMap.ALL_DAY) {
		var tabView = this._composeView.getTabView(this._composeView.getCurrentTab());
		if (tabView && tabView.toggleAllDayField) {
			tabView.toggleAllDayField();
		}

		return true;
	} else {
		return ZmCalItemComposeController.prototype.handleKeyAction.call(this, actionCode);
	}
};


// Private / Protected methods

ZmApptComposeController.prototype._getViewType =
function() {
	return ZmId.VIEW_APPOINTMENT;
};

ZmApptComposeController.prototype._attendeesUpdated =
function(appt, attId, attendees, origAttendees) {
	// create hashes of emails for comparison
	var origEmails = {};
	for (var i = 0; i < origAttendees.length; i++) {
		var email = origAttendees[i].getEmail();
		origEmails[email] = true;
	}
	var curEmails = {};
	for (var i = 0; i < attendees.length; i++) {
		var email = attendees[i].getEmail();
		curEmails[email] = true;
	}

	// walk the current list of attendees and check if there any new ones
	for (var i = 0 ; i < attendees.length; i++) {
		var email = attendees[i].getEmail();
		if (!origEmails[email]) {
			this._addedAttendees.push(email);
		}
	}

	for (var i = 0 ; i < origAttendees.length; i++) {
		var email = origAttendees[i].getEmail();
		if (!curEmails[email]) {
			this._removedAttendees.push(email);
		}
	}

	if (this._addedAttendees.length > 0 || this._removedAttendees.length > 0) {
		if (!this._notifyDialog) {
			this._notifyDialog = new ZmApptNotifyDialog(this._shell);
			this._notifyDialog.addSelectionListener(DwtDialog.OK_BUTTON, new AjxListener(this, this._notifyDlgOkListener));
			this._notifyDialog.addSelectionListener(DwtDialog.CANCEL_BUTTON, new AjxListener(this, this._notifyDlgCancelListener));
		}
		this._notifyDialog.initialize(appt, attId, this._addedAttendees, this._removedAttendees);
		this._notifyDialog.popup();
		return true;
	}

	return false;
};


// Listeners

// Cancel button was pressed
ZmApptComposeController.prototype._cancelListener =
function(ev) {
	this._app.getCalController().setNeedsRefresh(true);

	ZmCalItemComposeController.prototype._cancelListener.call(this, ev);
};


// Callbacks

ZmApptComposeController.prototype._postHideCallback =
function() {
	if (appCtxt.numVisibleAccounts > 1) {
		appCtxt.getApp(ZmApp.CALENDAR).getOverviewPanelContent().setEnabled(true);
	}
};

ZmApptComposeController.prototype._notifyDlgOkListener =
function(ev) {
	var notifyList = this._notifyDialog.notifyNew() ? this._addedAttendees : null;
	this._saveCalItemFoRealz(this._notifyDialog.getAppt(), this._notifyDialog.getAttId(), notifyList);
	this._app.popView(true);
};

ZmApptComposeController.prototype._notifyDlgCancelListener =
function(ev) {
	this._addedAttendees.length = this._removedAttendees.length = 0;
};

ZmApptComposeController.prototype._changeOrgCallback =
function(appt, attId, dlg) {
	dlg.popdown();
	this._saveCalItemFoRealz(appt, attId);
	this._app.popView(true);
};

ZmApptComposeController.prototype._clearInvalidAttendeesCallback =
function(appt, attId, dlg) {	
	dlg.popdown();
	delete this._invalidAttendees;
	this._saveListener();
};
