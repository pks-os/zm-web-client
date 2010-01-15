<%--
 * ***** BEGIN LICENSE BLOCK *****
 * 
 * Zimbra Collaboration Suite Web Client
 * Copyright (C) 2006, 2007, 2008 Zimbra, Inc.
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
<%@ taglib prefix="c" uri="http://java.sun.com/jsp/jstl/core" %>
<%@ taglib prefix="fn" uri="http://java.sun.com/jsp/jstl/functions" %>
<%@ taglib prefix="fmt" uri="com.zimbra.i18n" %>
<%@ taglib prefix="app" uri="com.zimbra.htmlclient" %>
<%@ taglib prefix="zm" uri="com.zimbra.zm" %>
<%@ attribute name="context" rtexprvalue="true" required="false" type="com.zimbra.cs.taglib.tag.SearchContext"%>

<app:handleError>
<zm:requirePost/>
<zm:checkCrumb crumb="${param.crumb}"/>
<zm:getMailbox var="mailbox"/>
<c:set var="ids" value="${fn:join(paramValues.id, ',')}"/>
<c:set var="folderId" value="${not empty paramValues.folderId[0] ? paramValues.folderId[0] : paramValues.folderId[1]}"/>
<c:set var="actionOp" value="${not empty paramValues.actionOp[0] ? paramValues.actionOp[0] :  paramValues.actionOp[1]}"/>

<c:choose>
<c:when test="${zm:actionSet(param, 'actionCompose')}">
    <jsp:forward page="/h/compose"/>
</c:when>
<c:when test="${zm:actionSet(param, 'actionMarkTagRead')}">
    <c:set var="tagName" value="${zm:getTagName(pageContext, param.contextTagId)}"/>
    <zm:markTagRead id="${param.contextTagId}"/>
    <app:status>
        <fmt:message key="actionTagMarkRead">
            <fmt:param value="${tagName}"/>
        </fmt:message>
    </app:status>
</c:when>
<c:when test="${zm:actionSet(param, 'actionMarkFolderRead')}">
    <c:set var="folderName" value="${zm:getFolderName(pageContext, param.contextFolderId)}"/>
    <zm:markFolderRead id="${param.contextFolderId}"/>
    <app:status>
        <fmt:message key="actionFolderMarkRead">
            <fmt:param value="${folderName}"/>
        </fmt:message>
    </app:status>
</c:when>
<c:when test="${zm:actionSet(param, 'actionEmpty') and (param.contextFolderId eq mailbox.trash.id) and (param.confirmed ne '1')}">
    <zm:checkCrumb crumb="${param.crumb}"/>
    <app:status html="true">
        <fmt:message key="confirmEmptyTrashFolder">
            <fmt:param value="<form style='padding:0px;margin:0px;' action='?doConvListViewAction=1&actionEmpty=true&${pageContext.request.queryString}' method='post'><input type='hidden' name='confirmed' value='1'/><input type='hidden' name='crumb' value='${fn:escapeXml(mailbox.accountInfo.crumb)}'/><input type='hidden' name='contextFolderId' value='${param.contextFolderId}'/>"/>
            <fmt:param value="<input type='submit' value='yes'>"/>
            <fmt:param value="</form>"/>
        </fmt:message>
    </app:status>
</c:when>
<c:when test="${zm:actionSet(param, 'actionEmpty') and ((param.contextFolderId eq mailbox.trash.id and param.confirmed eq '1') or param.contextFolderId eq mailbox.spam.id)}">
    <zm:emptyFolder id="${param.contextFolderId}"/>
    <app:status>
        <fmt:message key="folderEmptied">
            <fmt:param value="${zm:getFolderName(pageContext, param.contextFolderId)}"/>
        </fmt:message>
    </app:status>
</c:when>
<c:when test="${zm:actionSet(param, 'actionLoadFeed')}">
    <zm:syncFolder id="${param.contextFolderId}"/>
    <zm:clearSearchCache/>
    <app:status>
        <fmt:message key="feedLoaded">
            <fmt:param value="${zm:getFolderName(pageContext, param.contextFolderId)}"/>
        </fmt:message>
    </app:status>
</c:when>
<c:when test="${empty ids}">
    <app:status style="Warning"><fmt:message key="actionNoConvSelected"/></app:status>
</c:when>
<c:otherwise>
<c:choose>
<c:when test="${zm:actionSet(param, 'actionSpam')}">
    <zm:markConversationSpam  var="result" id="${ids}" spam="true"/>
    <app:status>
        <fmt:message key="actionConvMarkedSpam">
            <fmt:param value="${result.idCount}"/>
        </fmt:message>
    </app:status>
</c:when>
<c:when test="${zm:actionSet(param, 'actionNotSpam')}">
    <zm:markConversationSpam  var="result" id="${ids}" spam="false"/>
    <app:status>
        <fmt:message key="actionConvMarkedNotSpam">
            <fmt:param value="${result.idCount}"/>
        </fmt:message>
    </app:status>
</c:when>
<c:when test="${zm:actionSet(param,'actionDelete')}">
    <zm:trashConversation  var="result" id="${ids}"/>
    <app:status>
        <fmt:message key="actionConvMovedTrash">
            <fmt:param value="${result.idCount}"/>
        </fmt:message>
    </app:status>
</c:when>
<c:when test="${zm:actionSet(param, 'actionHardDelete')}">
    <zm:deleteConversation  var="result" id="${ids}"/>
    <app:status>
        <fmt:message key="actionConvHardDeleted">
            <fmt:param value="${result.idCount}"/>
        </fmt:message>
    </app:status>
</c:when>
<c:when test="${zm:actionSet(param, 'actionPrint')}">
    <jsp:forward page="/h/printconversations"/>
</c:when>
<c:when test="${zm:actionSet(param, 'action')}">
    <c:choose>
        <c:when test="${actionOp eq 'unread' or actionOp eq 'read'}">
            <zm:markConversationRead var="result" id="${ids}" read="${actionOp eq 'read'}"/>
            <app:status>
                <fmt:message key="${actionOp eq 'read' ? 'actionConvMarkedRead' : 'actionConvMarkedUnread'}">
                    <fmt:param value="${result.idCount}"/>
                </fmt:message>
            </app:status>
        </c:when>
        <c:when test="${actionOp eq 'actionSpam'}">
            <zm:markConversationSpam  var="result" id="${ids}" spam="true"/>
            <app:status>
                <fmt:message key="actionConvMarkedSpam">
                    <fmt:param value="${result.idCount}"/>
                </fmt:message>
            </app:status>
        </c:when>
        <c:when test="${actionOp eq 'actionNotSpam'}">
            <zm:markConversationSpam  var="result" id="${ids}" spam="false"/>
            <app:status>
                <fmt:message key="actionConvMarkedNotSpam">
                    <fmt:param value="${result.idCount}"/>
                </fmt:message>
            </app:status>
        </c:when>
        <c:when test="${actionOp eq 'flag' or actionOp eq 'unflag'}">
            <zm:flagConversation var="result" id="${ids}" flag="${actionOp eq 'flag'}"/>
            <app:status>
                <fmt:message key="${actionOp eq 'flag' ? 'actionConvFlag' : 'actionConvUnflag'}">
                    <fmt:param value="${result.idCount}"/>
                </fmt:message>
            </app:status>
        </c:when>
        <c:when test="${fn:startsWith(actionOp, 't:') or fn:startsWith(actionOp, 'u:')}">
            <c:set var="untagall" value="${fn:startsWith(actionOp, 'u:all')}"/>
            <c:choose>
                <c:when test="${untagall}" >
                    <zm:forEachTag var="eachtag">
                        <zm:tagConversation tagid="${eachtag.id}" var="result" id="${ids}" tag="false"/>
                    </zm:forEachTag>
                    <app:status>
                        <fmt:message key="${'actionConvUntagAll'}">
                            <fmt:param value="${result.idCount}"/>
                        </fmt:message>
                    </app:status>
                </c:when>
                <c:otherwise>
                    <c:set var="istag" value="${fn:startsWith(actionOp, 't')}"/>
                    <c:set var="tagid" value="${fn:substring(actionOp, 2, -1)}"/>
                    <zm:tagConversation tagid="${tagid}" var="result" id="${ids}" tag="${istag}"/>
                    <app:status>
                        <fmt:message key="${istag ? 'actionConvTag' : 'actionConvUntag'}">
                            <fmt:param value="${result.idCount}"/>
                            <fmt:param value="${zm:getTagName(pageContext, tagid)}"/>
                        </fmt:message>
                    </app:status>
                </c:otherwise>
            </c:choose>
        </c:when>
        <c:otherwise>
            <app:status style="Warning"><fmt:message key="actionNoActionSelected"/></app:status>
        </c:otherwise>
    </c:choose>
</c:when>
<c:when test="${zm:actionSet(param, 'actionMove')}">
    <c:choose>
        <c:when test="${fn:startsWith(folderId, 'm:')}">
            <c:set var="folderid" value="${fn:substring(folderId, 2, -1)}"/>
            <zm:moveConversation folderid="${folderid}"var="result" id="${ids}"/>
            <app:status>
                <fmt:message key="actionConvMoved">
                    <fmt:param value="${result.idCount}"/>
                    <fmt:param value="${zm:getFolderName(pageContext, folderid)}"/>
                </fmt:message>
            </app:status>
        </c:when>
        <c:otherwise>
            <app:status style="Warning"><fmt:message key="actionNoFolderSelected"/></app:status>
        </c:otherwise>
    </c:choose>
</c:when>
</c:choose>
</c:otherwise>
</c:choose>

</app:handleError>