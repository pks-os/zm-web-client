/*
 * ***** BEGIN LICENSE BLOCK *****
 * Version: ZPL 1.2
 * 
 * The contents of this file are subject to the Zimbra Public License
 * Version 1.2 ("License"); you may not use this file except in
 * compliance with the License. You may obtain a copy of the License at
 * http://www.zimbra.com/license
 * 
 * Software distributed under the License is distributed on an "AS IS"
 * basis, WITHOUT WARRANTY OF ANY KIND, either express or implied. See
 * the License for the specific language governing rights and limitations
 * under the License.
 * 
 * The Original Code is: Zimbra Collaboration Suite Web Client
 * 
 * The Initial Developer of the Original Code is Zimbra, Inc.
 * Portions created by Zimbra are Copyright (C) 2004, 2005, 2006, 2007 Zimbra, Inc.
 * All Rights Reserved.
 * 
 * Contributor(s):
 * 
 * ***** END LICENSE BLOCK *****
 */

/**
 * Creates a controller to run ZimbraMail. Do not call directly, instead use the run()
 * factory method.
 * @constructor
 * @class
 * This class is the "ubercontroller", as it manages all the apps as well as bootstrapping
 * the ZimbraMail application.
 *
 * @param params	[hash]			hash of params:
 *        app		[constant]		starting app
 *        userShell	[Element]		top-level skin container
 */
ZmZimbraMail = function(params) {

	ZmController.call(this, null);

	this._userShell = params.userShell;
	this._requestMgr = new ZmRequestMgr(this);

	// app event handling
	this._evt = new ZmAppEvent();
	this._evtMgr = new AjxEventMgr();
	// copy over any statically registered listeners
	for (var type in ZmZimbraMail._listeners) {
		var list = ZmZimbraMail._listeners[type];
		if (list && list.length) {
			for (var i = 0; i < list.length; i++) {
				this._evtMgr.addListener(type, list[i]);
			}
		}
	}

	// ALWAYS set back reference into our world (also used by unload handler)
	window._zimbraMail = this;
	
	// setup history support
	if (!AjxEnv.isSafari) {
		window.historyMgr = appCtxt.getHistoryMgr();
	}
	
	// settings structure and defaults
	this._settings = appCtxt.getSettings();
	var branch = appCtxt.get(ZmSetting.BRANCH);
    if (window.DBG && !DBG.isDisabled()) {
		DBG.setTitle("Debug (" + branch + ")");
    }
    var listener = new AjxListener(this, this._settingsChangeListener);
	this._settings.getSetting(ZmSetting.QUOTA_USED).addChangeListener(listener);
	this._settings.getSetting(ZmSetting.POLLING_INTERVAL).addChangeListener(listener);
	this._settings.getSetting(ZmSetting.SKIN_NAME).addChangeListener(listener);
	this._settings.getSetting(ZmSetting.LOCALE_NAME).addChangeListener(listener);
	this._settings.getSetting(ZmSetting.SHORTCUTS).addChangeListener(listener);

	appCtxt.setAppController(this);

	this._shell = appCtxt.getShell();

	this._apps = {};
	this._upsellView = {};
	this._activeApp = null;
	this._sessionTimer = new AjxTimedAction(null, ZmZimbraMail.logOff);
	this._sessionTimerId = -1;
	this._pollActionId = null;	// AjaxTimedAction ID of timer counting down to next poll time
	this._pollRequest = null;	// HTTP request of poll we've sent to server
	this._pollInstantNotifications = false; // if TRUE, we're in "instant notification" mode

//	if (appCtxt.get(ZmSetting.OFFLINE)) {
//		this._pollInstantNotifications = true;
//	}

	this.setPollInterval();

	AjxDispatcher.setPackageLoadFunction("Zimlet", new AjxCallback(this, this._postLoadZimlet));

	AjxDispatcher.setPreLoadFunction(new AjxCallback(this, function() {
		this._appViewMgr.pushView(ZmController.LOADING_VIEW);
	}));
	AjxDispatcher.setPostLoadFunction(new AjxCallback(this, function() {
		this._appViewMgr._toRemove.push(ZmController.LOADING_VIEW);
	}));

	for (var i in ZmApp.QS_ARG) {
		ZmApp.QS_ARG_R[ZmApp.QS_ARG[i]] = i;
	}

	// callbacks to run after start app has rendered
	var callback = new AjxCallback(this,
		function() {
			AjxDispatcher.require("Startup2");
		});
	this.postRenderCallbacks = [callback];

	this.startup(params);
};

ZmZimbraMail.prototype = new ZmController;
ZmZimbraMail.prototype.constructor = ZmZimbraMail;

// REVISIT: This is done so that we when we switch from being "beta"
//          to production, we don't have to ensure that all of the
//          translations are changed at the same time. We can simply
//          remove the beta suffix from the app name.
ZmMsg.BETA_documents = [ZmMsg.documents, ZmMsg.beta].join(" ");

ZmZimbraMail._PREFS_ID	= 1;
ZmZimbraMail._HELP_ID	= 2;
ZmZimbraMail._LOGOFF_ID	= 3;

// Static listener registration
ZmZimbraMail._listeners = {};

// Public methods

ZmZimbraMail.prototype.toString =
function() {
	return "ZmZimbraMail";
};

/**
 * Sets up ZimbraMail, and then starts it by calling its constructor. It is assumed that the
 * CSFE is on the same host.
 *
 * @param params			[hash]			hash of params:
 *        app				[constant]*		starting app
 *        offlineMode		[boolean]*		if true, this is the offline client
 *        devMode			[boolean]*		if true, we are in development environment
 *        settings			[hash]*			server prefs/attrs
 *        protocolMode		[constant]*		http, https, or mixed
 *        noSplashScreen	[boolean]*		if true, do not show splash screen during startup
 */
ZmZimbraMail.run =
function(params) {
	
	if (params.noSplashScreen) {
		ZmZimbraMail.killSplash();
	}

	// Create the global app context
	window.appCtxt = new ZmAppCtxt();
	appCtxt.setRememberMe(false);

	// Create and initialize settings
	var settings = new ZmSettings();
	appCtxt.setSettings(settings);
	
	if (params.settings) {
		for (var name in params.settings) {
			var id = settings.getSettingByName(name);
			if (id) {
				settings.getSetting(id).setValue(params.settings[name]);
			}
		}
	} else {
		// Note: removing cookie support may affect offline.jsp
		var apps = AjxCookie.getCookie(document, ZmSetting.APPS_COOKIE);
		DBG.println(AjxDebug.DBG1, "apps: " + apps);
		if (apps) {
			for (var setting in ZmSetting.APP_LETTER) {
				var letter = ZmSetting.APP_LETTER[setting];
				if (apps.indexOf(letter) != -1) {
					appCtxt.set(setting, true);
				}
			}
		}
	}

	// Create generic operations
	ZmOperation.initialize();

	// Handle offline mode
    if (params.offlineMode) {
    	DBG.println(AjxDebug.DBG1, "OFFLINE MODE");
    	appCtxt.set(ZmSetting.OFFLINE, true);
    	appCtxt.set(ZmSetting.POLLING_INTERVAL, 60);
    }
    
    // Handle dev mode
    if (params.devMode) {
    	DBG.println(AjxDebug.DBG1, "DEV MODE");
    	appCtxt.set(ZmSetting.DEV, true);
    	appCtxt.set(ZmSetting.POLLING_INTERVAL, 0);
    }

	if (params.protocolMode) {
		appCtxt.set(ZmSetting.PROTOCOL_MODE, params.protocolMode);
	}

	// Create the shell
	var userShell = params.userShell = window.document.getElementById(settings.get(ZmSetting.SKIN_SHELL_ID));
	if (!userShell) {
		alert("Could not get user shell - skin file did not load properly");
	}
	var shell = new DwtShell({userShell:userShell, docBodyScrollable:false});
	appCtxt.setShell(shell);

	appCtxt.setItemCache(new AjxCache());

	// Go!
	new ZmZimbraMail(params);
};

/**
* Allows parent window to walk list of open child windows and either nuke them
* or "disable" them.
*/
ZmZimbraMail.unload =
function() {
	var childWinList = window._zimbraMail ? window._zimbraMail._childWinList : null;
	if (childWinList) {
		// close all child windows
		for (var i = 0; i < childWinList.size(); i++) {
			var childWin = childWinList.get(i);
			childWin.win.onbeforeunload = null;
			childWin.win.parentController = null;
			childWin.win.close();
		}
	}
	window._zimbraMail = window.onload = window.onresize = window.document.onkeypress = null;
};

/**
 * Returns sort order using a and b as keys into given hash.
 * 
 * @param hash		[hash]		hash with sort values
 * @param a			[string]	key into hash
 * @param b			[string]	key into hash
 */
ZmZimbraMail.hashSortCompare =
function(hash, a, b) {
	var appA = a ? Number(hash[a]) : 0;
	var appB = b ? Number(hash[b]) : 0;
	if (appA > appB) { return 1; }
	if (appA < appB) { return -1; }
	return 0;
};

/**
 * Hides the splash screen.
 */
ZmZimbraMail.killSplash =
function() {
	// 	Splash screen is now a part of the skin, loaded in statically via the JSP 
	//	as a well-known ID.  To hide the splash screen, just hide that div.
	var splashDiv = Dwt.byId("skin_container_splash_screen");
	if (splashDiv) {
		Dwt.hide(splashDiv);
	}
};

/**
 * Startup part 1:
 * 	- check for skin, show it
 * 	- create app view mgr
 * 	- create components (sash, banner, user info, toolbar above overview, status view)
 * 	- create apps
 * 	- load user settings (GetInfoRequest)
 *
 * @param params		[hash]			hash of params:
 *        app			[constant]*		starting app
 *        isRelogin		[boolean]*		user has re-authenticated after session timeout
 *        settings		[hash]*			settings overrides
 */
ZmZimbraMail.prototype.startup =
function(params) {
	
	appCtxt.inStartup = true;
	if (typeof(skin) == "undefined") {
		DBG.println(AjxDebug.DBG1, "No skin!");
		var url = AjxUtil.formatUrl({path:"/public/skinError.jsp", qsArgs:{skin:appCurrentSkin}, qsReset:true});
		ZmZimbraMail.sendRedirect(url);
        return;
    }

	if (!this._appViewMgr) {
		this._appViewMgr = new ZmAppViewMgr(this._shell, this, false, true);
	}

	skin.show("skin", true);
	var hint = appCtxt.get(ZmSetting.SKIN_HINTS, "app_chooser.style");
	this._TAB_SKIN_ENABLED = (hint == "tabs");
	if (!this._components) {
		this._components = {};
		this._components[ZmAppViewMgr.C_SASH] = new DwtSash(this._shell, DwtSash.HORIZONTAL_STYLE, "console_inset_app_l", 20);
		this._components[ZmAppViewMgr.C_BANNER] = this._createBanner();
		this._components[ZmAppViewMgr.C_USER_INFO] = this._userNameField = this._createUserInfo("BannerTextUser", ZmAppViewMgr.C_USER_INFO);
		this._components[ZmAppViewMgr.C_QUOTA_INFO] = this._usedQuotaField = this._createUserInfo("BannerTextQuota", ZmAppViewMgr.C_QUOTA_INFO);
		var currentAppToolbar = new ZmCurrentAppToolBar(this._shell);
		appCtxt.setCurrentAppToolbar(currentAppToolbar);
		this._components[ZmAppViewMgr.C_CURRENT_APP] = currentAppToolbar;
		this._components[ZmAppViewMgr.C_STATUS] = this._statusView = new ZmStatusView(this._shell, "ZmStatus", Dwt.ABSOLUTE_STYLE);
	}

	this._createEnabledApps();
	this._registerOrganizers();

	// set up map of search types to item types
	for (var i in ZmSearch.TYPE) {
		ZmSearch.TYPE_MAP[ZmSearch.TYPE[i]] = i;
	}
	// organizer types based on view
	for (var i in ZmOrganizer.VIEWS) {
		var list = ZmOrganizer.VIEWS[i];
		for (var j = 0; j < list.length; j++) {
			ZmOrganizer.TYPE[list[j]] = i;
		}
	}

	// We've received canned SOAP responses for GetInfoRequest and SearchRequest from the
	// launch JSP, wrapped in a BatchRequest. Jiggle them so that they look like real
	// responses, and pass them along.
	if (params.batchInfoResponse) {
		var br = params.batchInfoResponse.Body.BatchResponse;
		var girJSON = params.getInfoResponse = {};
		girJSON.Body = {};
		girJSON.Body.GetInfoResponse = br.GetInfoResponse[0];
		girJSON.Header = params.batchInfoResponse.Header;
		var srJSON = params.searchResponse = {};
		srJSON.Body = {};
		srJSON.Body.SearchResponse = br.SearchResponse[0];
	}

	this._getStartApp(params);
	if (params.startApp == ZmApp.MAIL) {
		this._doingPostRenderStartup = true;
	}

	var respCallback = new AjxCallback(this, this._handleResponseStartup, params);
	this._errorCallback = new AjxCallback(this, this._handleErrorStartup, params);
	this._settings.loadUserSettings(respCallback, this._errorCallback, null, params.getInfoResponse);
};

ZmZimbraMail.prototype._handleErrorStartup =
function(params, ex) {
	ZmZimbraMail.killSplash();
	appCtxt.inStartup = false;
	return false;
};

/**
 * Startup: part 2
 * 	- create app toolbar component
 * 	- determine and launch starting app
 *
 * @param params			[hash]			hash of params:
 *        app				[constant]		starting app
 *        settingOverrides	[Object]		hash of overrides of user settings
 * @param result			[ZmCsfeResult]	result object from load of user settings
 */
ZmZimbraMail.prototype._handleResponseStartup =
function(params, result) {

	if (params && params.settingOverrides) {
		this._needOverviewLayout = true;
		for (var id in params.settingOverrides) {
			var setting = this._settings.getSetting(id);
			if (setting) {
				setting.setValue(params.settingOverrides[id]);
			}
		}
	}
	
	if (!appCtxt.get(ZmSetting.DEV) && appCtxt.get(ZmSetting.WARN_ON_EXIT)) {
		window.onbeforeunload = ZmZimbraMail._confirmExitMethod;
	}	

	if (!this._components[ZmAppViewMgr.C_APP_CHOOSER]) {
		this._components[ZmAppViewMgr.C_APP_CHOOSER] = this._appChooser = this._createAppChooser();
	}

	ZmApp.initialize();

	params.result = result;
	var respCallback = new AjxCallback(this, this._handleResponseStartup1, params);

	// startup and packages have been optimized for quick mail display
	if (this._doingPostRenderStartup) {
		this.addAppListener(params.startApp, ZmAppEvent.POST_RENDER, new AjxListener(this, this._postRenderStartup));
		this._searchResponse = params.searchResponse;
	} else {
		AjxDispatcher.require("Startup2");
	}
	this.activateApp(params.startApp, false, respCallback, this._errorCallback, params.checkQS);
};

/**
 * Startup: part 3
 * 	- populate user info
 * 	- create search bar
 * 	- set up keyboard handling (shortcuts and tab groups)
 * 	- kill splash, show UI
 * 	- check license
 *
 * @param app		[constant]		starting app
 */
ZmZimbraMail.prototype._handleResponseStartup1 =
function(params) {

	this._setUserInfo();

	if (appCtxt.get(ZmSetting.SEARCH_ENABLED)) {
		this._components[ZmAppViewMgr.C_SEARCH] = appCtxt.getSearchController().getSearchPanel();
	}

	this._initKeyboardHandling();
	
	this.setSessionTimer(true);
	ZmZimbraMail.killSplash();

	// next line makes the UI appear
	this._appViewMgr.addComponents(this._components, true);

	if (appCtxt.get(ZmSetting.LICENSE_STATUS) != ZmSetting.LICENSE_GOOD) {
		var dlg = appCtxt.getMsgDialog();
		dlg.reset();
		dlg.setMessage(ZmMsg.licenseExpired, DwtMessageDialog.WARNING_STYLE);
		dlg.popup();
	}

	var callback = new AjxCallback(this,
		function() {
			this.focusContentPane();
			this.runAppFunction("startup", false, params.result);
			AjxDispatcher.enableLoadFunctions(true);
			appCtxt.inStartup = false;
			this._evtMgr.notifyListeners(ZmAppEvent.POST_STARTUP, this._evt);
		});
	this.postRenderCallbacks.push(callback);
	if (!this._doingPostRenderStartup) {
		this._postRenderStartup();
	}
};

/**
 * Startup: part 4
 * 
 * The work to render the start app has been done. Now perform all the startup
 * work that remains, using a timed action so that the start app gets rendered
 * in the UI first.
 */
ZmZimbraMail.prototype._postRenderStartup =
function(ev) {
	AjxTimedAction.scheduleAction(new AjxTimedAction(this, 
		function() {
			for (var i = 0; i < this.postRenderCallbacks.length; i++) {
				this.postRenderCallbacks[i].run();
			}
		}), 0);
};

ZmZimbraMail.prototype._getStartApp =
function(params) {
	// determine starting app
	var startApp;
	if (params && params.app) {
		startApp = ZmApp.QS_ARG_R[params.app.toLowerCase()];
	}
	if (!startApp) {
		for (var app in ZmApp.DEFAULT_SORT) {
			ZmApp.DEFAULT_APPS.push(app);
		}
		ZmApp.DEFAULT_APPS.sort(function(a, b) {
			return ZmZimbraMail.hashSortCompare(ZmApp.DEFAULT_SORT, a, b);
		});
		for (var i = 0; i < ZmApp.DEFAULT_APPS.length; i++) {
			var app = ZmApp.DEFAULT_APPS[i];
			var setting = ZmApp.SETTING[app];
			if (!setting || appCtxt.get(setting)) {
				this._defaultStartApp = app;
				break;
			}
		}
		startApp = (params && params.isRelogin && this._activeApp) ? this._activeApp : this._defaultStartApp;
	}

	// check for jump to compose page or msg view
	var checkQS = false;
	if (startApp == ZmApp.CALENDAR) {
		// let calendar check for jumps
		checkQS = true;
	} else {
		var match;
		if (location.search && (match = location.search.match(/\bview=(\w+)\b/))) {
			var view = match[1];
			startApp = this._defaultStartApp;
			if (ZmApp.QS_VIEWS[view]) {
				startApp = ZmApp.QS_VIEWS[view];
				checkQS = true;
			}
		}
	}

	params.startApp = startApp;
	params.checkQS = checkQS;	
};

/**
* Performs a 'running restart' of the app by clearing state and calling the startup method.
* This method is run after a logoff, or a change in what's supported.
*/
ZmZimbraMail.prototype.restart =
function(settings) {
	// need to decide what to clean up, what to have startup load lazily
	// could have each app do shutdown()
	DBG.println(AjxDebug.DBG1, "RESTARTING APP");
	this.reset();
   	this.startup({settingOverrides:settings});
};

ZmZimbraMail.prototype.reset =
function() {
	ZmCsfeCommand.setSessionId(null);	// so we get a refresh block
    this._highestNotifySeen = 0; 		// we have a new session

	var accts = appCtxt.getZimbraAccounts();
	for (var id in accts) {
		var trees = accts[id].trees;
	    for (var type in trees) {
	    	var tree = trees[type];
	    	if (tree && tree.reset) {
	    		tree.reset();
	    	}
	 	}
	}

	if (!appCtxt.rememberMe()) {
		appCtxt.getLoginDialog().clearAll();
	}
	for (var app in this._apps) {
		this._apps[app] = null;
	}
	this._activeApp = null;
	this._appViewMgr.reset();
};

ZmZimbraMail.prototype.sendRequest =
function(params) {
	return this._requestMgr.sendRequest(params);
};

/**
 * Runs the given function for all enabled apps, passing args.
 * 
 * @param funcName		[string]	function name
 * @param force			[boolean]*	if true, run func for disabled apps as well
 */
ZmZimbraMail.prototype.runAppFunction =
function(funcName, force) {
	var args = [];
	for (var i = 2; i < arguments.length; i++) {
		args.push(arguments[i]);
	}
	for (var i = 0; i < ZmApp.APPS.length; i++) {
		var appName = ZmApp.APPS[i];
		var setting = ZmApp.SETTING[appName];
		if (!setting || appCtxt.get(setting) || force) {
			var app = appCtxt.getApp(appName);
			var func = app[funcName];
			if (func && (typeof(func) == "function")) {
				func.apply(app, args);
			}
		}
	}
};

/**
 * Instantiates enabled apps. An optional argument may be given limiting the set
 * of apps that may be created.
 * 
 * @param apps	[hash]*		the set of apps to create
 */
ZmZimbraMail.prototype._createEnabledApps =
function(apps) {
	for (var app in ZmApp.CLASS) {
		if (!apps || apps[app]) {
			ZmApp.APPS.push(app);
		}
	}
	ZmApp.APPS.sort(function(a, b) {
		return ZmZimbraMail.hashSortCompare(ZmApp.LOAD_SORT, a, b);
	});
	
	// Instantiate enabled apps, which will invoke app registration.
	// We also create "upsell" apps, which will only show the content of a URL in an iframe,
	// to encourage the user to upgrade.
	for (var i = 0; i < ZmApp.APPS.length; i++) {
		var app = ZmApp.APPS[i];
		var setting = ZmApp.SETTING[app];
		var upsellSetting = ZmApp.UPSELL_SETTING[app];
		if ((setting && appCtxt.get(setting)) || (upsellSetting && appCtxt.get(upsellSetting))) {
			this._createApp(app);
		}
	}
};

/**
 * Static function to add a listener before this class has been instantiated.
 * During construction, listeners are copied to the event manager. This function
 * could be used by a skin, for example.
 *
 * @param type		[constant]		event type
 * @param listener	[AjxListener]	a listener
 */
ZmZimbraMail.addListener =
function(type, listener) {
	if (!ZmZimbraMail._listeners[type]) {
		ZmZimbraMail._listeners[type] = [];
	}
	ZmZimbraMail._listeners[type].push(listener);
};

/**
 * Static function to add an app listener before this class has been
 * instantiated. This is separate from {@link ZmZimbraMail#addListener}
 * so that the caller doesn't need to know the specifics of how we
 * twiddle the type name for app events.
 */
ZmZimbraMail.addAppListener = function(appName, type, listener) {
	type = [appName, type].join("_");
	ZmZimbraMail.addListener(type, listener);
};

/**
 * Adds a listener for the given event type.
 *
 * @param type		[constant]		event type
 * @param listener	[AjxListener]	a listener
 */
ZmZimbraMail.prototype.addListener =
function(type, listener) {
	return this._evtMgr.addListener(type, listener);
};

/**
 * Removes a listener for the given event type.
 *
 * @param type		[constant]		event type
 * @param listener	[AjxListener]	a listener
 */
ZmZimbraMail.prototype.removeListener =
function(type, listener) {
	return this._evtMgr.removeListener(type, listener);    	
};

/**
 * Adds a listener for the given event type and app.
 *
 * @param app		[constant]		app name
 * @param type		[constant]		event type
 * @param listener	[AjxListener]	a listener
 */
ZmZimbraMail.prototype.addAppListener =
function(app, type, listener) {
	type = [app, type].join("_");
	return this.addListener(type, listener);
};

/**
 * Removes a listener for the given event type and app.
 *
 * @param app		[constant]		app name
 * @param type		[constant]		event type
 * @param listener	[AjxListener]	a listener
 */
ZmZimbraMail.prototype.removeAppListener =
function(app, type, listener) {
	type = [app, type].join("_");
	return this.removeListener(type, listener);
};

/**
 * Send a NoOpRequest to the server.  Used for '$set:noop'
 */
ZmZimbraMail.prototype.sendNoOp =
function() {
    var soapDoc = AjxSoapDoc.create("NoOpRequest", "urn:zimbraMail");
    this.sendRequest({soapDoc:soapDoc, asyncMode:true, noBusyOverlay:true});
};

ZmZimbraMail.prototype.sendSync =
function(callback) {
    var soapDoc = AjxSoapDoc.create("SyncRequest", "urn:zimbraOffline");
    this.sendRequest({soapDoc:soapDoc, asyncMode:true, noBusyOverlay:true, callback:callback});
};

/**
 * Put the client into "instant notifications" mode.
 */
ZmZimbraMail.prototype.setInstantNotify =
function(on) {
    if (on) {
        this._pollInstantNotifications = true;
        // set a nonzero poll interval so that we cannot ever get into a
		// full-speed request loop
        this._pollInterval = 100;
        if (this._pollActionId) {
            AjxTimedAction.cancelAction(this._pollActionId);
            this._pollActionId = null;
        }
        this._kickPolling(true);
    } else {
        this._pollInstantNotifications = false;
        this.setPollInterval(true);
    }
}

/**
 * Resets the interval between poll requests, based on what's in the settings,
 * only if we are not in instant notify mode.
 *
 * @param kickMe	[boolean]*		if true, start the poll timer
 */
ZmZimbraMail.prototype.setPollInterval =
function(kickMe) {
    if (!this._pollInstantNotifications) {
        this._pollInterval = appCtxt.get(ZmSetting.POLLING_INTERVAL) * 1000;
        DBG.println(AjxDebug.DBG1, "poll interval = " + this._pollInterval + "ms");

        if (this._pollInterval) {
        	if (kickMe) {
	            this._kickPolling(true);
	        }
        } else {
            // cancel pending request if there is one
            if (this._pollRequest) {
                this._requestMgr.cancelRequest(this._pollRequest);
                this._pollRequest = null;
            }
            // cancel timer if it is waiting...
            if (this._pollActionId) {
                AjxTimedAction.cancelAction(this._pollActionId);
                this._pollActionId = null;
            }
        }
        return true;
    } else {
        this._pollInterval = 100;
        DBG.println(AjxDebug.DBG1, "Ignoring Poll Interval (in instant-notify mode)");
        return false;
    }
};

/*
 * Make sure the polling loop is running.  Basic flow:
 *
 *       1) kickPolling():
 *             - cancel any existing timers
 *             - set a timer for _pollInterval time
 *             - call execPoll() when the timer goes off
 *
 *       2) execPoll():
 *             - make the NoOp request, if we're in "instant notifications"
 *               mode, this request will hang on the server until there is more data,
 *               otherwise it will return immediately.  Call into a handle() func below
 *
 *       3) handleDoPollXXXX():
 *             - call back to kickPolling() above
 *
 * resetBackoff = TRUE e.g. if we've just received a successful
 * response from the server, or if the user just changed our
 * polling settings and we want to start in fast mode
 */
ZmZimbraMail.prototype._kickPolling =
function(resetBackoff) {
	var msg = ["ZmZimbraMail._kickPolling(1) ", this._pollInterval, ", ", this._pollActionId, 
			   ", ", this._pollRequest ? "request_pending" : "no_request_pending"].join("");
    DBG.println(AjxDebug.DBG2, msg);

    // reset the polling timeout
    if (this._pollActionId) {
        AjxTimedAction.cancelAction(this._pollActionId);
        this._pollActionId = null;
    }

    if (resetBackoff && this._pollInstantNotifications) {
        if (this._pollInterval > 100) {
            // we *were* backed off -- reset the delay back to 1s fastness
            this._pollInterval = 100;
            // need to kick the timer if it is waiting -- it might be waiting a long time
            // and we want the change to take place immediately
            if (this._pollActionId) {
                AjxTimedAction.cancelAction(this._pollActionId);
                this._pollActionId = null;
            }
        }
    }

    if (this._pollInterval && !this._pollActionId && !this._pollRequest) {
        try {
            var pollAction = new AjxTimedAction(this, this._execPoll);
            this._pollActionId = AjxTimedAction.scheduleAction(pollAction, this._pollInterval);
        } catch (ex) {
            this._pollActionId = null;
            DBG.println(AjxDebug.DBG1, "Caught exception in ZmZimbraMail._kickPolling.  Polling chain broken!");
        }
    }
  };
  
/*
 * We've finished waiting, do the actual poll itself
 */
ZmZimbraMail.prototype._execPoll =
function() {
    this._pollActionId = null;

    // It'd be more efficient to make these instance variables, but for some
    // reason that breaks polling in IE.
    var soapDoc = AjxSoapDoc.create("NoOpRequest", "urn:zimbraMail");
    try {
        if (this._pollInstantNotifications) {
            var method = soapDoc.getMethod();
            method.setAttribute("wait", 1);
            method.setAttribute("limitToOneBlocked", 1);
        }
        var responseCallback = new AjxCallback(this, this._handleResponseDoPoll);
        var errorCallback = new AjxCallback(this, this._handleErrorDoPoll);

        this._pollRequest = this.sendRequest({soapDoc:soapDoc, asyncMode:true, callback:responseCallback, errorCallback:errorCallback,
        									  noBusyOverlay:true, timeout:appCtxt.get(ZmSetting.INSTANT_NOTIFY_TIMEOUT)});
    } catch (ex) {
        // oops!
        this._handleErrorDoPoll(ex);
    }
}


ZmZimbraMail.prototype._handleErrorDoPoll =
function(ex) {
    this._pollRequest = null;

    if (this._pollInstantNotifications) {
        // very simpleminded exponential backoff
        this._pollInterval *= 2;
        if (this._pollInterval > (1000 * 60 * 2)) {
            this._pollInterval = 1000 * 60 * 2;
        }
    }
    // restart poll timer if we didn't get an exception
    this._kickPolling(false);

    return (ex.code != ZmCsfeException.SVC_AUTH_EXPIRED &&
  			ex.code != ZmCsfeException.SVC_AUTH_REQUIRED &&
  			ex.code != ZmCsfeException.NO_AUTH_TOKEN);
  };


ZmZimbraMail.prototype._handleResponseDoPoll =
function(result) {
    this._pollRequest = null;
    var noopResult = result.getResponse().NoOpResponse;
    if (noopResult.waitDisallowed) {
        // go back to polling mode b/c the server doesn't
        // want us to use instant notify.
        this.setInstantNotify(false);
    }  else {
        // restart poll timer if we didn't get an exception
   	    this._kickPolling(true);
    }
};

ZmZimbraMail.prototype.getKeyMapMgr =
function() {
	var kbMgr = appCtxt.getKeyboardMgr();
	if (!kbMgr.__keyMapMgr) {
		this._initKeyboardHandling();
	}
	return kbMgr.__keyMapMgr;
};

ZmZimbraMail.prototype._initKeyboardHandling =
function() {
	var kbMgr = appCtxt.getKeyboardMgr();
	if (appCtxt.get(ZmSetting.USE_KEYBOARD_SHORTCUTS)) {
		// Register our keymap and global key action handler with the shell's keyboard manager
		kbMgr.enable(true);
		kbMgr.registerKeyMap(new ZmKeyMap());
		kbMgr.pushDefaultHandler(this);

		DBG.println(AjxDebug.DBG2, "SETTING SEARCH CONTROLLER TAB GROUP");
		var rootTg = appCtxt.getRootTabGroup();
		if (appCtxt.get(ZmSetting.SEARCH_ENABLED)) {
			rootTg.addMember(appCtxt.getSearchController().getTabGroup());
		}
		var appChooserTg = new DwtTabGroup("ZmAppChooser");
		appChooserTg.addMember(this._components[ZmAppViewMgr.C_APP_CHOOSER]);
		if (this._TAB_SKIN_ENABLED) {
			rootTg.addMember(appChooserTg);
		}
		// Add dummy app view tab group. This will get replaced right away when the
		// app view comes into play
		var dummyTg = new DwtTabGroup("DUMMY APPVIEW");
		ZmController._setCurrentAppViewTabGroup(dummyTg);
		rootTg.addMember(dummyTg);
		if (!this._TAB_SKIN_ENABLED) {
			rootTg.addMember(appChooserTg);
		}
		kbMgr.setTabGroup(rootTg);
		
		this._settings._loadShortcuts();
	} else {
		kbMgr.enable(false);
	}
};

ZmZimbraMail.prototype._registerOrganizers =
function() {
	ZmOrganizer.registerOrg(ZmOrganizer.FOLDER,
							{nameKey:			"folder",
							 defaultFolder:		ZmOrganizer.ID_INBOX,
							 soapCmd:			"FolderAction",
							 firstUserId:		256,
							 orgClass:			"ZmFolder",
							 treeController:	"ZmFolderTreeController",
							 labelKey:			"folders",
							 itemsKey:			"messages",
							 hasColor:			true,
							 defaultColor:		ZmOrganizer.C_NONE,
							 treeType:			ZmOrganizer.FOLDER,
							 views:				["message", "conversation"],
							 folderKey:			"mailFolder",
							 mountKey:			"mountFolder",
							 createFunc:		"ZmOrganizer.create",
							 compareFunc:		"ZmFolder.sortCompare",
							 shortcutKey:		"F"
							});

	ZmOrganizer.registerOrg(ZmOrganizer.SEARCH,
							{nameKey:			"savedSearch",
							 precondition:		ZmSetting.SAVED_SEARCHES_ENABLED,
							 soapCmd:			"FolderAction",
							 firstUserId:		256,
							 orgClass:			"ZmSearchFolder",
							 treeController:	"ZmSearchTreeController",
							 labelKey:			"searches",
							 treeType:			ZmOrganizer.FOLDER,
							 createFunc:		"ZmSearchFolder.create",
							 compareFunc:		"ZmFolder.sortCompare",
							 shortcutKey:		"S"
							});

	ZmOrganizer.registerOrg(ZmOrganizer.TAG,
							{nameKey:			"tag",
							 precondition:		ZmSetting.TAGGING_ENABLED,
							 soapCmd:			"TagAction",
							 firstUserId:		64,
							 orgClass:			"ZmTag",
							 treeController:	"ZmTagTreeController",
							 hasColor:			true,
							 defaultColor:		ZmOrganizer.C_ORANGE,
							 labelKey:			"tags",
							 treeType:			ZmOrganizer.TAG,
							 createFunc:		"ZmTag.create",
							 compareFunc:		"ZmTag.sortCompare",
							 shortcutKey:		"T"
							});
};

/**
* Returns a handle to the given app.
*
* @param appName	an app name
*/
ZmZimbraMail.prototype.getApp =
function(appName) {
	if (!this._apps[appName]) {
		this._createApp(appName);
	}
	return this._apps[appName];
};

/**
* Returns a handle to the app view manager.
*/
ZmZimbraMail.prototype.getAppViewMgr =
function() {
	return this._appViewMgr;
};

ZmZimbraMail.prototype.getActiveApp =
function() {
	return this._activeApp;
};

ZmZimbraMail.prototype.getPreviousApp =
function() {
	return this._previousApp;
};

/**
* Activates the given app.
*
* @param appName		[constant]		application
* @param force			[boolean]*		if true, launch the app
* @param callback		[AjxCallback]*	callback
* @param errorCallback	[AjxCallback]*	error callback
* @param checkQS		[boolean]*		if true, check query string for launch args
*/
ZmZimbraMail.prototype.activateApp =
function(appName, force, callback, errorCallback, checkQS) {
    DBG.println(AjxDebug.DBG1, "activateApp: " + appName + ", current app = " + this._activeApp);

    var view = this._appViewMgr.getAppView(appName);
    if (view && !force) {
    	// if the app has been launched, make its view the current one
	    DBG.println(AjxDebug.DBG3, "activateApp, current " + appName + " view: " + view);
		if (this._appViewMgr.pushView(view)) {
		    this._appViewMgr.setAppView(appName, view);
		}
		if (callback) {
			callback.run();
		}
	} else {
    	// launch the app
    	if (!this._apps[appName]) {
			this._createApp(appName);
    	}
    	var appEnabled = appCtxt.get(ZmApp.SETTING[appName]);
		var upsellEnabled = appCtxt.get(ZmApp.UPSELL_SETTING[appName]);
		if (!appEnabled && upsellEnabled) {
			this._createUpsellView(appName);
		} else {
			DBG.println(AjxDebug.DBG1, "Launching app " + appName);
			var respCallback = new AjxCallback(this, this._handleResponseActivateApp, [callback]);
			var eventType = [appName, ZmAppEvent.PRE_LAUNCH].join("_");
			this._evt.item = this._apps[appName];
			this._evtMgr.notifyListeners(eventType, this._evt);
			this._apps[appName].launch(respCallback, checkQS, this._searchResponse);
			delete this.searchResponse;
		}
    }
};

ZmZimbraMail.prototype._handleResponseActivateApp =
function(callback) {
	if (callback) {
		callback.run();
	}
};

/**
* Handles a change in which app is current. The change will be reflected in the
* current app toolbar and the overview. The previous and newly current apps are
* notified of the change. This method is called after a new view is pushed.
*
* @param appName	[constant]	the newly current app
* @param view		[constant]	the newly current view
*/
ZmZimbraMail.prototype.setActiveApp =
function(appName, view) {

	// update app chooser
	this._components[ZmAppViewMgr.C_APP_CHOOSER].setSelected(appName);

	// app not actually enabled if this is result of upsell view push
   	var appEnabled = appCtxt.get(ZmApp.SETTING[appName]);

	// update current app toolbar
	var toolbar = appEnabled ? appCtxt.getCurrentAppToolbar() : null;
	if (toolbar) {
		toolbar.setupView(appName);
	}

	if (this._activeApp != appName) {

		// deactivate previous app
	    if (this._activeApp) {
			// some views are not stored in _apps collection, so check if it exists.
			var app = this._apps[this._activeApp];
			if (app) {
				app.activate(false, view);
			}
			this._previousApp = this._activeApp;
	    }

	    // switch app
		this._activeApp = appName;
		if (appEnabled) {
			if (ZmApp.DEFAULT_SEARCH[appName]) {
				appCtxt.getSearchController().setDefaultSearchType(ZmApp.DEFAULT_SEARCH[appName], true);
			}
			
			// set search string value to match current app's last search, if applicable		
			var app = this._apps[this._activeApp];
			var stb = appCtxt.getSearchController().getSearchToolbar();
			if (appCtxt.get(ZmSetting.SHOW_SEARCH_STRING) && stb) {
				stb.setSearchFieldValue(app.currentQuery ? app.currentQuery : "");
			}
	
			// activate current app
			if (app) {
				app.activate(true, view);
			}
		}
	}
};

ZmZimbraMail.prototype.getAppChooserButton =
function(id) {
	return this._components[ZmAppViewMgr.C_APP_CHOOSER].getButton(id);
};

/**
 * An app calls this once it has fully rendered, so that we may notify
 * any listeners.
 */
ZmZimbraMail.prototype.appRendered =
function(appName) {
	var eventType = [appName, ZmAppEvent.POST_RENDER].join("_");
	this._evtMgr.notifyListeners(eventType, this._evt);
};

// Private methods

// Creates an app object, which doesn't necessarily do anything just yet.
ZmZimbraMail.prototype._createApp =
function(appName) {
	if (!appName || this._apps[appName]) return;
	DBG.println(AjxDebug.DBG1, "Creating app " + appName);
	var appClass = eval(ZmApp.CLASS[appName]);
	this._apps[appName] = new appClass(this._shell);
};

ZmZimbraMail.prototype._setUserInfo = 
function() {
	if (this._TAB_SKIN_ENABLED) {
		var hideIcon = appCtxt.get(ZmSetting.SKIN_HINTS, "help_button.hideIcon");
		this._setUserInfoLink("ZmZimbraMail.helpLinkCallback();", "Help", ZmMsg.help, "skin_container_help", hideIcon);
		hideIcon = appCtxt.get(ZmSetting.SKIN_HINTS, "logout_button.hideIcon");
		var text = appCtxt.get(ZmSetting.OFFLINE) ? ZmMsg.setup : ZmMsg.logOff;
		this._setUserInfoLink("ZmZimbraMail.conditionalLogOff();", "Logoff", text, "skin_container_logoff", hideIcon);
	}

	var login = appCtxt.get(ZmSetting.USERNAME);
	var username = (appCtxt.get(ZmSetting.DISPLAY_NAME)) || login;
	if (username) {
		this._userNameField.getHtmlElement().innerHTML = username;
		if (AjxEnv.isLinux) {	// bug fix #3355
			this._userNameField.getHtmlElement().style.lineHeight = "13px";
		}
	}

	var userTooltip = (username != login) ? login : null;
	var quota = appCtxt.get(ZmSetting.QUOTA);
	var usedQuota = (appCtxt.get(ZmSetting.QUOTA_USED)) || 0;
	var size = AjxUtil.formatSize(usedQuota, false, 1);

	var data = {
		login: login,
		username: username,
		quota: quota,
		usedQuota: usedQuota,
		size: size
	};

	var quotaTooltip;
	var quotaTemplateId;
	if (quota) {
		quotaTemplateId = 'UsedLimited';
		data.limit = AjxUtil.formatSize(data.quota, false, 1);
		data.percent = Math.min(Math.round((data.usedQuota / data.quota) * 100), 100);
		data.desc = AjxMessageFormat.format(ZmMsg.quotaDescLimited, [data.percent+'%', data.limit]);
		var tooltipDesc = AjxMessageFormat.format(ZmMsg.quotaDescLimited, [size, data.limit]);
		quotaTooltip = [ZmMsg.quota, ": ", data.percent, "% ", '('+tooltipDesc+')'].join("");
	}
	else {
		data.desc = AjxMessageFormat.format(ZmMsg.quotaDescUnlimited, [size]);
		quotaTemplateId = 'UsedUnlimited';
	}

	data['id'] = this._usedQuotaField._htmlElId;
	this._usedQuotaField.getHtmlElement().innerHTML = AjxTemplate.expand('share.Quota#'+quotaTemplateId, data)

	if (userTooltip || quotaTooltip) {
		var subs = {
			userTooltip: userTooltip,
			quotaTooltip: quotaTooltip
		};
		var html = AjxTemplate.expand('share.Quota#Tooltip', subs);
		this._components[ZmAppViewMgr.C_USER_INFO].setToolTipContent(html);
		this._components[ZmAppViewMgr.C_QUOTA_INFO].setToolTipContent(html);
	}
};

ZmZimbraMail.prototype._setUserInfoLink =
function(staticFunc, icon, lbl, id, hideIcon) {
	var subs = {
		staticFunc: staticFunc,
		icon: icon,
		lbl: lbl,
		hideIcon: hideIcon
	};

	var cell = document.getElementById(id);
	if (cell) {
		cell.innerHTML = AjxTemplate.expand('share.App#UserInfo', subs);
	}
};

// Listeners

ZmZimbraMail.logOff =
function() {

	// stop keeping track of user input (if applicable)
	if (window._zimbraMail) {
		window._zimbraMail.setSessionTimer(false);
	}

	ZmCsfeCommand.clearAuthToken();
	
	window.onbeforeunload = null;
	
	var url = appCtxt.get(ZmSetting.LOGOUT_URL);
	if (!url) {
		url = AjxUtil.formatUrl({path:appContextPath});
	}
	ZmZimbraMail.sendRedirect(url);
};

ZmZimbraMail._logOffListener = new AjxListener(null, ZmZimbraMail.logOff);

ZmZimbraMail.conditionalLogOff =
function() {
	if (window._zimbraMail && !window._zimbraMail._appViewMgr.isOkToLogOff(ZmZimbraMail._logOffListener)) {
		return;
	}
	ZmZimbraMail.logOff();
};

ZmZimbraMail.helpLinkCallback =
function() {
	ZmZimbraMail.unloadHackCallback();

	var appCtxt = window.parentAppCtxt || window.appCtxt;
	var url;
	try { url = skin.hints.help_button.url; } catch (e) { /* ignore */ }
	window.open(url || appCtxt.get(ZmSetting.HELP_URI));
};

ZmZimbraMail.sendRedirect =
function(locationStr) {
	// not sure why IE doesn't allow this to process immediately, but since
	// it does not, we'll set up a timed action.
	if (AjxEnv.isIE) {
		var act = new AjxTimedAction(null, ZmZimbraMail.redir, [locationStr]);
		AjxTimedAction.scheduleAction(act, 1);
	} else {
		ZmZimbraMail.redir(locationStr);
	}
};

ZmZimbraMail.redir =
function(locationStr){
	window.location = locationStr;
};

ZmZimbraMail.prototype.setSessionTimer =
function(bStartTimer) {

	// if no timeout value, user's client never times out from inactivity	
	var timeout = appCtxt.get(ZmSetting.IDLE_SESSION_TIMEOUT) * 1000;
	if (timeout <= 0)
		return;

	if (bStartTimer) {
		DBG.println(AjxDebug.DBG3, "INACTIVITY TIMER SET (" + (new Date()).toLocaleString() + ")");
		this._sessionTimerId = AjxTimedAction.scheduleAction(this._sessionTimer, timeout);
		
		DwtEventManager.addListener(DwtEvent.ONMOUSEUP, ZmZimbraMail._userEventHdlr);
		this._shell.setHandler(DwtEvent.ONMOUSEUP, ZmZimbraMail._userEventHdlr);
		if (AjxEnv.isIE)
			this._shell.setHandler(DwtEvent.ONMOUSEDOWN, ZmZimbraMail._userEventHdlr);
		else
			window.onkeydown = ZmZimbraMail._userEventHdlr;
	} else {
		DBG.println(AjxDebug.DBG3, "INACTIVITY TIMER CANCELED (" + (new Date()).toLocaleString() + ")");
		
		AjxTimedAction.cancelAction(this._sessionTimerId);
		this._sessionTimerId = -1;

		DwtEventManager.removeListener(DwtEvent.ONMOUSEUP, ZmZimbraMail._userEventHdlr);
		this._shell.clearHandler(DwtEvent.ONMOUSEUP);
		if (AjxEnv.isIE)
			this._shell.clearHandler(DwtEvent.ONMOUSEDOWN);
		else
			window.onkeydown = null;
	}
};

ZmZimbraMail.prototype.addChildWindow = 
function(childWin) {
	if (this._childWinList == null)
		this._childWinList = new AjxVector();

	// NOTE: we now save childWin w/in Object so other params can be added to it.
	// Otherwise, Safari breaks (see http://bugs.webkit.org/show_bug.cgi?id=7162)
	var newWinObj = new Object();
	newWinObj.win = childWin;

	this._childWinList.add(newWinObj);

	return newWinObj;
};

ZmZimbraMail.prototype.getChildWindow = 
function(childWin) {
	if (this._childWinList) {
		for (var i = 0; i < this._childWinList.size(); i++) {
			if (childWin == this._childWinList.get(i).win) {
				return this._childWinList.get(i);
			}
		}
	}
	return null;
};

ZmZimbraMail.prototype.removeChildWindow =
function(childWin) {
	if (this._childWinList) {
		for (var i = 0; i < this._childWinList.size(); i++) {
			if (childWin == this._childWinList.get(i).win) {
				this._childWinList.removeAt(i);
				break;
			}
		}
	}
};

/*
* Common exception handling entry point.
*
* @param ex	[Object]		the exception
* 
*/
ZmZimbraMail.prototype._handleException =
function(ex, method, params, restartOnError, obj) {
	var handled = false;
	if (ex.code == ZmCsfeException.MAIL_NO_SUCH_FOLDER) {
		var organizerTypes = [ZmOrganizer.CALENDAR, ZmOrganizer.NOTEBOOK, ZmOrganizer.ADDRBOOK];
		if (ex.data.itemId && ex.data.itemId.length) {
			var itemId = ex.data.itemId[0];
			var index = itemId.lastIndexOf(':');
			var zid = itemId.substring(0, index);
			var rid = itemId.substring(index + 1, itemId.length);
			var ft = appCtxt.getFolderTree();
			for (var type = 0; type < organizerTypes.length; type++) {
				handled |= ft.handleNoSuchFolderError(organizerTypes[type], zid, rid, true);
			}
		}
	}
	if (!handled) {
		ZmController.prototype._handleException.call(this, ex, method, params, restartOnError, obj);
	}
};

// This method is called by the window.onbeforeunload method.
ZmZimbraMail._confirmExitMethod =
function() {
	return ZmMsg.appExitWarning;
};

ZmZimbraMail.unloadHackCallback =
function() {
	window.onbeforeunload = null;
	var f = function() { window.onbeforeunload = ZmZimbraMail._confirmExitMethod; };
	var t = new AjxTimedAction(null, f);
	AjxTimedAction.scheduleAction(t, 3000);
};

ZmZimbraMail._userEventHdlr =
function(ev) {
	var zm = window._zimbraMail;
	if (zm) {
		// cancel old timer and start a new one
		AjxTimedAction.cancelAction(zm._sessionTimerId);
		var timeout = appCtxt.get(ZmSetting.IDLE_SESSION_TIMEOUT) * 1000;
		zm._sessionTimerId = AjxTimedAction.scheduleAction(zm._sessionTimer, timeout);
	}
	DBG.println(AjxDebug.DBG3, "INACTIVITY TIMER RESET (" + (new Date()).toLocaleString() + ")");
};

ZmZimbraMail.prototype._settingsChangeListener =
function(ev) {
	if (ev.type != ZmEvent.S_SETTING) return;
	
	var id = ev.source.id;
	if (id == ZmSetting.QUOTA_USED) {
		this._setUserInfo();
	} else if (id == ZmSetting.POLLING_INTERVAL) {
		this.setPollInterval();
	} else if (id == ZmSetting.SKIN_NAME) {
		var cd = this._confirmDialog = appCtxt.getYesNoMsgDialog();
		cd.reset();
		var skin = ev.source.getValue();
		cd.registerCallback(DwtDialog.YES_BUTTON, this._newSkinYesCallback, this, [skin]);
		cd.setMessage(ZmMsg.skinChangeRestart, DwtMessageDialog.WARNING_STYLE);
		cd.popup();
	} else if (id == ZmSetting.LOCALE_NAME) {
		var cd = this._confirmDialog = appCtxt.getYesNoMsgDialog();
		cd.reset();
		var skin = ev.source.getValue();
		cd.registerCallback(DwtDialog.YES_BUTTON, this._newLocaleYesCallback, this);
		cd.setMessage(ZmMsg.localeChangeRestart, DwtMessageDialog.WARNING_STYLE);
		cd.popup();
	} else if (id == ZmSetting.SHORTCUTS) {
		appCtxt.getKeyboardMgr().registerKeyMap(new ZmKeyMap());
		this._settings._loadShortcuts();
	}
};

ZmZimbraMail.prototype._newSkinYesCallback =
function(skin) {
	this._confirmDialog.popdown();
    window.onbeforeunload = null;
    var url = AjxUtil.formatUrl({qsArgs:{skin:skin}});
	DBG.println(AjxDebug.DBG1, "skin change, redirect to: " + url);
    ZmZimbraMail.sendRedirect(url); // redirect to self to force reload
};

ZmZimbraMail.prototype._newLocaleYesCallback =
function(skin) {
	this._confirmDialog.popdown();
    window.onbeforeunload = null;
    var url = AjxUtil.formatUrl();
	DBG.println(AjxDebug.DBG1, "skin change, redirect to: " + url);
    ZmZimbraMail.sendRedirect(url); // redirect to self to force reload
};

ZmZimbraMail.prototype._createBanner =
function() {
	// The LogoContainer style centers the logo
	var banner = new DwtComposite(this._shell, null, Dwt.ABSOLUTE_STYLE);
	var logoUrl = appCtxt.get(ZmSetting.SKIN_HINTS, "logo.url") || appCtxt.get(ZmSetting.LOGO_URI);
	var html = [];
	var i = 0;
	html[i++] = "<table border=0 cellpadding=0 cellspacing=0 style='width:100%;height:100%'>";
	html[i++] = "<tr><td align='center' valign='middle'>";
	html[i++] = "<a href='";
	html[i++] = logoUrl;
	html[i++] = "' target='_blank'><div class='";
	html[i++] = AjxImg.getClassForImage("AppBanner");
	html[i++] = "'></div></a></td></tr></table>";
	banner.getHtmlElement().innerHTML = html.join("");
	return banner;
};

ZmZimbraMail.prototype._createUserInfo =
function(className, cid) {
    var position = appCtxt.get(ZmSetting.SKIN_HINTS, [cid, "position"].join("."));
    var posStyle = position || Dwt.ABSOLUTE_STYLE;
    var ui = new DwtComposite(this._shell, className, posStyle);
    if (posStyle == Dwt.ABSOLUTE_STYLE) {
        ui.setScrollStyle(Dwt.CLIP);
    }
    ui._setMouseEventHdlrs();
	return ui;
};

ZmZimbraMail.prototype._createAppChooser =
function() {
	
	var buttons = [];
	for (var id in ZmApp.CHOOSER_SORT) {
		if (this._TAB_SKIN_ENABLED && (id == ZmAppChooser.SPACER || id == ZmAppChooser.B_HELP || id == ZmAppChooser.B_LOGOUT)) {
			continue;
		}

		var setting = ZmApp.SETTING[id];
		var upsellSetting = ZmApp.UPSELL_SETTING[id];
		if ((setting && appCtxt.get(setting)) || (upsellSetting && appCtxt.get(upsellSetting))) {
			buttons.push(id);
		}
	}
	buttons.sort(function(a, b) {
		return ZmZimbraMail.hashSortCompare(ZmApp.CHOOSER_SORT, a, b);
	});

	var appChooser = new ZmAppChooser(this._shell, null, buttons, this._TAB_SKIN_ENABLED);
	
	var buttonListener = new AjxListener(this, this._appButtonListener);
	for (var i = 0; i < buttons.length; i++) {
		var id = buttons[i];
		if (id == ZmAppChooser.SPACER) continue;
		var b = appChooser.getButton(id);
		b.addSelectionListener(buttonListener);
	}

	return appChooser;
};

ZmZimbraMail.prototype._appButtonListener =
function(ev) {
	try {
		var id = ev.item.getData(Dwt.KEY_ID);
		DBG.println(AjxDebug.DBG1, "ZmZimbraMail button press: " + id);
		if (id == ZmAppChooser.B_HELP) {
			window.open(appCtxt.get(ZmSetting.HELP_URI));
		} else if (id == ZmAppChooser.B_LOGOUT) {
			ZmZimbraMail.conditionalLogOff();
		} else if (id) {
			this.activateApp(id);
		}
	} catch (ex) {
		this._handleException(ex, this._appButtonListener, ev, false);
	}
};

ZmZimbraMail.prototype.getAppChooser =
function() {
	return this._appChooser;
};

ZmZimbraMail.prototype.setStatusMsg =
function(msg, level, detail) {
	this._statusView.setStatusMsg(msg, level, detail);
};

ZmZimbraMail.prototype.getKeyMapName =
function() {
	var ctlr = appCtxt.getCurrentController();
	if (ctlr && ctlr.getKeyMapName) {
		return ctlr.getKeyMapName();
	}
	return "Global";
};

ZmZimbraMail.prototype.handleKeyAction =
function(actionCode, ev) {

	var app = ZmApp.GOTO_ACTION_CODE_R[actionCode];
	if (app) {
		if (app == this.getActiveApp()) { return false; }
		this.activateApp(app);
		return true;
	}

	// don't honor plain Enter in an input field as an app shortcut, since it often
	// equates to button press in that situation
	if (ev && (ev.keyCode == 13 || ev.keyCode == 3) && 
		!(ev.altKey || ev.ctrlKey || ev.metaKey || ev.shiftKey) &&
		 ev.target && (ev.target.id != DwtKeyboardMgr.FOCUS_FIELD_ID)) { return false; }

	switch (actionCode) {
		case ZmKeyMap.DBG_NONE:
			appCtxt.setStatusMsg("Setting Debug Level To: " + AjxDebug.NONE);
			DBG.setDebugLevel(AjxDebug.NONE);
			break;
			
		case ZmKeyMap.DBG_1:
			appCtxt.setStatusMsg("Setting Debug Level To: " + AjxDebug.DBG1);
			DBG.setDebugLevel(AjxDebug.DBG1);
			break;
			
		case ZmKeyMap.DBG_2:
			appCtxt.setStatusMsg("Setting Debug Level To: " + AjxDebug.DBG2);
			DBG.setDebugLevel(AjxDebug.DBG2);
			break;
			
		case ZmKeyMap.DBG_3:
			appCtxt.setStatusMsg("Setting Debug Level To: " + AjxDebug.DBG3);
			DBG.setDebugLevel(AjxDebug.DBG3);
			break;
			
		case ZmKeyMap.DBG_TIMING: {
			var on = DBG._showTiming;
			var newState = on ? "off" : "on";
			appCtxt.setStatusMsg("Turning Timing Info " + newState);
			DBG.showTiming(!on);
			break;
		}
		
		case ZmKeyMap.ASSISTANT: {
			if (!this._assistantDialog) {
				AjxDispatcher.require("Assistant");
				this._assistantDialog = new ZmAssistantDialog();
			}
			this._assistantDialog.popup();
			break;
		}
		
		case ZmKeyMap.LOGOFF: {
			ZmZimbraMail.conditionalLogOff();
			break;
		}
		
		case ZmKeyMap.FOCUS_SEARCH_BOX: {
			var stb = appCtxt.getSearchController().getSearchToolbar();
			if (stb) {
				var searchBox = stb.getSearchField();
				appCtxt.getKeyboardMgr().grabFocus(searchBox);
			}
			break;
		}

		case ZmKeyMap.FOCUS_CONTENT_PANE: {
			this.focusContentPane();
			break;
		}
			
		default: {
			var ctlr = appCtxt.getCurrentController();
			return (ctlr && ctlr.handleKeyAction)
				? ctlr.handleKeyAction(actionCode, ev)
				: false;
		}
	}
	return true;
};

ZmZimbraMail.prototype.focusContentPane =
function() {
	// Set focus to the list view that's in the content pane. If there is no
	// list view in the content pane, nothing happens. The list view will be
	// found in the root tab group hierarchy.
	var ctlr = appCtxt.getCurrentController();
	var content = ctlr ? ctlr.getCurrentView() : null;
	if (content) {
		appCtxt.getKeyboardMgr().grabFocus(content);
	}
};

/**
 * Creates an "upsell view", which is a placeholder view for an app that's not
 * enabled but which has a button so that it can be promoted. The app will have
 * a URL for its upsell content, which we put into an IFRAME.
 * 
 * @param appName	[constant]		name of app
 */
ZmZimbraMail.prototype._createUpsellView =
function(appName) {
	var upsellView = this._upsellView[appName] = new DwtControl(this._shell, null, Dwt.ABSOLUTE_STYLE);
	var upsellUrl = appCtxt.get(ZmApp.UPSELL_URL[appName]);
	var el = upsellView.getHtmlElement();
	var htmlArr = [];
	var idx = 0;
	htmlArr[idx++] = "<iframe width='100%' height='100%' src='";
	htmlArr[idx++] = upsellUrl;
	htmlArr[idx++] = "'>";
	el.innerHTML = htmlArr.join("");
	var elements = {};
	elements[ZmAppViewMgr.C_APP_CONTENT_FULL] = upsellView;
	var viewName = [appName, "upsell"].join("_");
	this._appViewMgr.createView(viewName, appName, elements, null, true);
	this._appViewMgr.pushView(viewName);
};

/**
 * Sets up Zimlet organizer type. This is run if we get zimlets in the
 * GetInfoResponse. Note that this will run before apps are instantiated,
 * which is necessary because they depend on knowing whether there are zimlets.
 */
ZmZimbraMail.prototype._postLoadZimlet =
function() {
	appCtxt.setZimletsPresent(true);
	ZmOrganizer.registerOrg(ZmOrganizer.ZIMLET,
							{orgClass:			"ZmZimlet",
							 treeController:	"ZmZimletTreeController",
							 labelKey:			"zimlets",
							 compareFunc:		"ZmZimlet.sortCompare"
							});
	for (var app in ZmApp.SHOW_ZIMLETS) {
		var trees = ZmApp.OVERVIEW_TREES[app] || [];
		trees.push(ZmOrganizer.ZIMLET);
	}
};
// YUCK:
ZmOrganizer.ZIMLET = "Zimlet";
