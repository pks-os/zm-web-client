<%--
 * ***** BEGIN LICENSE BLOCK *****
 * 
 * Zimbra Collaboration Suite Web Client
 * Copyright (C) 2007, 2008 Zimbra, Inc.
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
<%@ tag body-content="empty" dynamic-attributes="dynattrs" %>
<%@ attribute name="firstAttachment" rtexprvalue="true" required="true" type="java.lang.String" %>
<%@ attribute name="url" rtexprvalue="true" required="true" type="java.lang.String" %>
<%@ attribute name="displayName" rtexprvalue="true" required="false" type="java.lang.String" %>
<%@ attribute name="contentType" rtexprvalue="true" required="false" type="java.lang.String" %>
<%@ attribute name="checked" rtexprvalue="true" required="true" type="java.lang.String" %>
<%@ attribute name="displaySize" rtexprvalue="true" required="false" type="java.lang.String" %>
<%@ attribute name="value" rtexprvalue="true" required="true" type="java.lang.String" %>
<%@ attribute name="name" rtexprvalue="true" required="true" type="java.lang.String" %>
<%@ taglib prefix="zm" uri="com.zimbra.zm" %>
<%@ taglib prefix="mo" uri="com.zimbra.mobileclient" %>
<%@ taglib prefix="c" uri="http://java.sun.com/jsp/jstl/core" %>
<%@ taglib prefix="fn" uri="http://java.sun.com/jsp/jstl/functions" %>
<%@ taglib prefix="fmt" uri="com.zimbra.i18n" %>
<fmt:setBundle basename="/msgs/ZhMsg" scope='request' />

<tr class="CompOrigAtt" valign="middle">
    <td>
        <c:set var="pname" value="${displayName}"/>
        <c:if test="${empty displayName}">
            <fmt:message key="unknownContentType" var="displayName">
                <fmt:param value="${contentType}"/>
            </fmt:message>
        </c:if>
        <table cellpadding="2" cellspacing="0" border="0">
            <tr valign="middle">
                <td align='right'>
                <%--<c:if test="${firstAttachment}">--%>
                    <mo:img altkey="ALT_ATTACHMENT" src="startup/ImgAttachment.gif"/>
                    <%--<c:set var="firstAttachment" value="${true}"/>
                </c:if>--%>
                </td>
                <td>
                    <input <c:if test="${checked}">checked </c:if>type=checkbox name="${name}" value="${value}">
                </td>
                <td>&nbsp;</td>
                <td>
                    <a target="_blank" href="${fn:escapeXml(url)}&amp;disp=i">${fn:escapeXml(displayName)}</a>&nbsp;<c:if test="${displaySize}">(${displaySize})</c:if>
                </td>
            </tr>
        </table>
    </td>
</tr>
