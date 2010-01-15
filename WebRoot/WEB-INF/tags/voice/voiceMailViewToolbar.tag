<%--
 * ***** BEGIN LICENSE BLOCK *****
 * 
 * Zimbra Collaboration Suite Web Client
 * Copyright (C) 2008, 2009 Zimbra, Inc.
 * 
 * The contents of this file are subject to the Zimbra Public License
 * Version 1.2 ("License"); you may not use this file except in
 * compliance with the License.  You may obtain a copy of the License at
 * http://www.zimbra.com/license.
 * 
 * Software distributed under the License is distributed on an "AS IS"
 * basis, WITHOUT WARRANTY OF ANY KIND, either express or implied.
 * 
 * ***** END LICENSE BLOCK *****
--%>
<%@ tag body-content="empty" %>
<%@ attribute name="context" rtexprvalue="true" required="true" type="com.zimbra.cs.taglib.tag.SearchContext"%>
<%@ attribute name="heard" rtexprvalue="true" required="true" type="java.lang.Boolean"%>
<%@ attribute name="isPrivate" rtexprvalue="true" required="true" type="java.lang.Boolean"%>
<%@ attribute name="saveAsUrl" rtexprvalue="true" required="true" type="java.lang.String"%>
<%@ attribute name="keys" rtexprvalue="true" required="true" %>
<%@ taglib prefix="c" uri="http://java.sun.com/jsp/jstl/core" %>
<%@ taglib prefix="fn" uri="http://java.sun.com/jsp/jstl/functions" %>
<%@ taglib prefix="fmt" uri="com.zimbra.i18n" %>
<%@ taglib prefix="app" uri="com.zimbra.htmlclient" %>
<%@ taglib prefix="zm" uri="com.zimbra.zm" %>

<zm:getMailbox var="mailbox"/>

<table width="100%" cellspacing="0" class='Tb'>
	  <tr valign='middle'>
		<td class='TbBT'>
			<table cellspacing="0" cellpadding="0" class='Tb'>
				<tr>
					<td nowrap>
						<zm:currentResultUrl var="closeurl" value="/h/search" index="${context.currentItemIndex}" context="${context}"/>
						<zm:currentResultUrl var="delRedirectUrl" value="/h/search" context="${context}" />
						<input type="hidden" value="${delRedirectUrl}" name="delRedirectUrl" />
						<a href="${fn:escapeXml(closeurl)}" <c:if test="${keys}">id="CLOSE_ITEM"</c:if>> <app:img src="common/ImgClose.gif" alt="close"/> <span>&nbsp;<fmt:message key="backToVoiceMail"/>&nbsp;</span></a>
					</td>
					<td><div class='vertSep'/></td>
					<app:button id="${keys ? 'OPDELETE' :''}" name="actionDelete" src="startup/ImgDelete.gif" text="actionDelete" tooltip="actionTrashTT"/>
					<td><div class='vertSep'/></td>
					<c:set var="disableMailButtons" value="${(mailbox.features.mail ne true) or isPrivate}"/>
					<app:button id="OPREPLYBYEMAIL" name="actionReplyByEmail" text="actionReplyByEmail" src="startup/ImgReply.gif" tooltip="actionReplyByEmailTT" disabled="${disableMailButtons}"/>
					<app:button id="OPFORWARDBYEMAIL" name="actionForwardByEmail" text="actionForwardByEmail" src="startup/ImgForward.gif" tooltip="actionForwardByEmailTT" disabled="${disableMailButtons}"/>
					<td><div class='vertSep'/></td>
					<td><a id="IOPDOWNLOAD" href="${saveAsUrl}"><app:img src="common/ImgSave.gif" altkey="actionDownload" clazz="${isPrivate ? 'ImgDisabled' : ''}" /></a></td>
					<td><div class='vertSep'/></td>
					<app:button id="OPHEARD" name="actionMarkHeard" text="actionMarkHeard" src="voicemail/ImgMarkAsHeard.gif" tooltip="actionMarkHeardTT" disabled="${isTrash or heard}"/>
					<app:button id="OPUNHEARD" name="actionMarkUnheard" text="actionMarkUnheard" src="voicemail/ImgMarkAsUnheard.gif" tooltip="actionMarkUnheardTT" disabled="${isTrash or not heard}"/>
					<%--
					<td><div class='vertSep'/></td>
					<app:button id="OPADDFORWARD" name="actionAddToForward" text="actionAddCallerToForward" tooltip="actionAddCallerToForwardTT"/>
					<app:button id="OPADDREJECT" name="actionAddToReject" text="actionAddCallerToReject" tooltip="actionAddCallerToRejectTT"/>
					--%>
				</tr>
			</table>
		</td>
<%-- Do this later: next/prev item buttons...
		<td align="right">
			<c:if test="${context.hasPrevItem}">
				<zm:prevItemUrl var="prevItemUrl" value="/h/search" action="view" cursor="${cursor}" context="${context}"/>
				<a  <c:if test="${keys}">id="PREV_ITEM" </c:if> href="${fn:escapeXml(prevItemUrl)}"><app:img altkey="ALT_MSG_PREVIOUS_MESSAGE" src="startup/ImgLeftArrow.gif" border="0" alt="prev"/></a>
			</c:if>
			<c:if test="${!context.hasPrevItem}">
				<app:img disabled='true' src="startup/ImgLeftArrow.gif" border="0" alt="no prev"/>
			</c:if>
			<span class='Paging'>${context.searchResult.offset+context.currentItemIndex+1}</span>
			<c:if test="${context.hasNextItem}">
				<zm:nextItemUrl var="nextItemUrl" value="/h/search" action="view" cursor="${cursor}" context="${context}"/>
				<a  <c:if test="${keys}">id="NEXT_ITEM" </c:if> href="${fn:escapeXml(nextItemUrl)}"><app:img altkey="ALT_MSG_NEXT_MESSAGE" src="startup/ImgRightArrow.gif" border="0" alt="next"/></a>
			</c:if>
			<c:if test="${!context.hasNextItem}">
				<app:img disabled='true' src="startup/ImgRightArrow.gif" border="0" alt="no next"/>
			</c:if>
		</td>
--%>
	</tr>
</table>

