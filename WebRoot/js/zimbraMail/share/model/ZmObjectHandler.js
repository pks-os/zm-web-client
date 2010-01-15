/*
 * ***** BEGIN LICENSE BLOCK *****
 * Zimbra Collaboration Suite Web Client
 * Copyright (C) 2004, 2005, 2006, 2007 Zimbra, Inc.
 * 
 * The contents of this file are subject to the Zimbra Public License
 * Version 1.2 ("License"); you may not use this file except in
 * compliance with the License.  You may obtain a copy of the License at
 * http://www.zimbra.com/license.
 * 
 * Software distributed under the License is distributed on an "AS IS"
 * basis, WITHOUT WARRANTY OF ANY KIND, either express or implied.
 * ***** END LICENSE BLOCK *****
 */

ZmObjectHandler = function(typeName, className) {
	if (arguments.length > 0) {
		this.init(typeName, className);
	}
}

ZmObjectHandler.prototype.constructor = ZmObjectHandler;

ZmObjectHandler.prototype.init =
function(typeName, className) {
	this._typeName = typeName;
	this._className = className ? className : "Object";
};

ZmObjectHandler.prototype.toString = 
function() {
	// If you can find a cleaner way to get the name of 
	// a sub-class without hard coding each instance
	// in a toString() method feel free to change.
	if(!this._toString) {
		var ctor = "" + this.constructor;
		ctor = ctor.substring(0,ctor.indexOf("("));
		this._toString = ctor.substring("function ".length);
	}
	return this._toString;
};

ZmObjectHandler.prototype.getTypeName =
function() {
	return this._typeName;
};

// OVERRIDE if need be
ZmObjectHandler.prototype.getClassName =
function(obj, context) {
	return this._className;
};

// OVERRIDE if need be
ZmObjectHandler.prototype.getHoveredClassName =
function(obj, context) {
	var cname = this.getClassName(obj);
	if (this._cachedClassNameForHovered !== cname) {
		this._cachedClassNameForHovered = cname;
		this._classNameHovered = cname + "-" + DwtCssStyle.HOVER;
	}
	return this._classNameHovered;
};

// OVERRIDE if need be
ZmObjectHandler.prototype.getActiveClassName =
function(obj, context) {
	var cname = this.getClassName(obj);
	if (this._cachedClassNameForActive !== cname) {
		this._cachedClassNameForActive = cname;
		this._classNameActive = cname + "-" + DwtCssStyle.ACTIVE;
	}
	return this._classNameActive;
};

ZmObjectHandler.prototype.findObject =
function(content, startIndex) {
	if (startIndex === 0) {
		this._lastMatch = null;
		this._noMatch = false;
	}
	if (this._noMatch) {return null;}
	if (this._lastMatch && this._lastMatch.index >= startIndex) {
		return this._lastMatch;
	}
	this._lastMatch = this.match(content, startIndex);
	this._noMatch = (this._lastMatch === null);
	return this._lastMatch;
};


/** OVERRIDE. returns non-null result in the format of String.match if text on the line matched this
* handlers regular expression.
* i.e: var result = handler.match(line);
* result[0] should be matched string
* result.index should be location within line match occured
* handlers can also set result.context which will be passed back to them during the various method calls (getToolTipText, etc)
*
* handlers should set regex.lastIndex to startIndex and then use regex.exec(content). they should also use the "g" option when
* constructing their regex.
*/
ZmObjectHandler.prototype.match =
function(content, startIndex) {
	return null;
};

// OVERRIDE IF NEED BE. Generates content inside the <span>
ZmObjectHandler.prototype._getHtmlContent =
function(html, idx, obj, context) {
	html[idx++] = AjxStringUtil.htmlEncode(obj, true);
	return idx;
};

// generates the span
ZmObjectHandler.prototype.generateSpan = 
function(html, idx, obj, spanId, context) {
	html[idx++] = "<span class='";
	html[idx++] = this.getClassName(obj);
	html[idx++] = "' id='";
	html[idx++] = spanId;
	html[idx++] = "'>";
	idx = this._getHtmlContent(html, idx, obj, context);
	html[idx++] = "</span>";
	return idx;
};

ZmObjectHandler.prototype.hasToolTipText =
function(obj, context) {
	return true;
};

ZmObjectHandler.prototype.getToolTipText =
function(obj, context) {
	return AjxStringUtil.htmlEncode(obj);
};

ZmObjectHandler.prototype.populateToolTip =
function(obj, context) {
};


ZmObjectHandler.prototype.getActionMenu =
function(obj, span, context) {
	return null;
};

ZmObjectHandler.prototype.selected =
function(obj, span, ev, context) {
	return this.clicked(span, obj, context, ev);
};

ZmObjectHandler.prototype.clicked =
function(span, obj, context, ev) {
};

ZmObjectHandler.prototype.hoverOver = function(object, context, x, y) {
	var shell = DwtShell.getShell(window);
	var tooltip = shell.getToolTip();
	tooltip.setContent(this.getToolTipText(object, context));
	tooltip.popup(x, y);
	this.populateToolTip(object, context);
};

ZmObjectHandler.prototype.hoverOut = function(object, context) {
	var shell = DwtShell.getShell(window);
	var tooltip = shell.getToolTip();
	tooltip.popdown();
};