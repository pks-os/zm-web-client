<%--
 * ***** BEGIN LICENSE BLOCK *****
 * 
 * Zimbra Collaboration Suite Web Client
 * Copyright (C) 2008 Zimbra, Inc.
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
<%@ attribute name="mailbox" rtexprvalue="true" required="false" type="com.zimbra.cs.taglib.bean.ZMailboxBean" %>
<%@ attribute name="defaultSkin" rtexprvalue="true" required="false" %>
<%@ taglib prefix="c" uri="http://java.sun.com/jsp/jstl/core" %>
<%@ taglib prefix="zm" uri="com.zimbra.zm" %>
<c:catch>
	<%-- NOTE: We have to check the session scope this way because it
	           will throw an exception if page is not participating in
	           a session. --%>
	<c:set var="sessionScope_skin" value="${sessionScope.skin}" />
</c:catch>
<c:choose>
	<c:when test="${not empty param.skin}">
		<c:catch var="ex">
			<c:if test="${empty mailbox}">
				<zm:getMailbox var='mailbox' />
			</c:if>
			<c:if test="${zm:contains(mailbox.availableSkins, param.skin)}">
				<c:set var="skin" scope="request" value="${param.skin}" />
				<c:set var="skin" scope="session" value="${param.skin}" />
			</c:if>
		</c:catch>
		<c:if test="${not empty ex}">
			<c:set var="skin" scope="request" value="${not empty defaultSkin ? defaultSkin : initParam.zimbraDefaultSkin}" />
		</c:if>
	</c:when>
	<c:when test="${not empty sessionScope_skin}">
		<c:set var="skin" scope="request" value="${sessionScope_skin}" />
	</c:when>
	<c:when test="${not empty mailbox}">
		<c:set var="skin" scope="request" value="${mailbox.prefs.skin}" />
	</c:when>
	<c:when test='${not empty defaultSkin}'>
		<c:set var="skin" scope="request" value="${defaultSkin}" />
	</c:when>
	<c:otherwise>
		<c:set var="skin" scope="request" value="${initParam.zimbraDefaultSkin}" />
	</c:otherwise>
</c:choose>
<c:choose>
    <c:when test="${skin eq 'yahoo'}">
        <c:set var="iconPath" value="/skins/yahoo/img" scope="request" />
    </c:when>
    <c:otherwise>
        <c:set var="iconPath" value="/img" scope="request" />
    </c:otherwise>
</c:choose>

