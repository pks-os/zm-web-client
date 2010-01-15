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
<%@ tag body-content="empty" %>
<%@ attribute name="context" rtexprvalue="true" required="true" type="com.zimbra.cs.taglib.tag.SearchContext" %>
<%@ attribute name="id" rtexprvalue="true" required="false" %>
<%@ taglib prefix="c" uri="http://java.sun.com/jsp/jstl/core" %>
<%@ taglib prefix="fn" uri="http://java.sun.com/jsp/jstl/functions" %>
<%@ taglib prefix="fmt" uri="com.zimbra.i18n" %>
<%@ taglib prefix="mo" uri="com.zimbra.mobileclient" %>
<%@ taglib prefix="zm" uri="com.zimbra.zm" %>
<%@ taglib prefix="app" uri="com.zimbra.htmlclient" %>
<c:set var="id" value="${not empty id?id:(empty param.id ? context.currentItem.id : param.id)}"/>
<mo:handleError>
    <zm:getMailbox var="mailbox"/>
    <zm:getContact id="${id}" var="contact"/>
    <c:set var="context_url" value="${requestScope.baseURL!=null?requestScope.baseURL:'mosearch'}"/>
    <zm:currentResultUrl var="closeUrl" value="${context_url}" context="${context}"/>
    <zm:computeNextPrevItem var="cursor" searchResult="${context.searchResult}" index="${context.currentItemIndex}"/>
</mo:handleError>


<mo:view mailbox="${mailbox}" title="${contact.displayFileAs}" context="${null}" clazz="zo_obj_body" scale="true">


    <table width="100%" cellpadding="0" cellspacing="0" border="0" class="Stripes">
        <tr>
            <td>
                <mo:contactToolbar cid="${contact.id}" urlTarget="${context_url}" context="${context}" keys="false"/>
            </td>
        </tr>
        <tr>
            <td><br>
            	<table cellpadding="2" cellspacing="0" border="0" width="100%">
                <tr>
                <td width="1%" class="Padding"><img src="<app:imgurl value='large/ImgPerson_48.gif' />" border="0" width="48" height="48" class="Padding"/></td>
                <td>
                <b>${fn:escapeXml(contact.displayFileAs)}<c:if test="${contact.isFlagged}">
                    <mo:img src="startup/ImgFlagRed.gif" alt="flag"/></c:if></b>
				<br>		            
                <c:if test="${not empty contact.jobTitle}">
                   <span class="SmallText">${fn:escapeXml(contact.jobTitle)}</span>
                <br>
                </c:if>
                <c:if test="${not empty contact.company}">
                   <span class="SmallText">${fn:escapeXml(contact.company)}</span>
                </c:if>
                </td></tr>
                <tr><td colspan="2">
                <c:if test="${contact.hasTags and mailbox.features.tagging}">
                    <hr size="1"/>
                    <c:set var="tags" value="${zm:getTags(pageContext, contact.tagIds)}"/>
                    <c:forEach items="${tags}" var="tag">
                        <span><mo:img src="${tag.miniImage}" alt='${fn:escapeXml(tag.name)}'/>
                        ${fn:escapeXml(tag.name)}</span>
                    </c:forEach>
                </c:if>    
                </td></tr>
				</table>
                <mo:displayContact contact="${contact}"/>
            </td>
        </tr>
        <tr>
            <td align="center">
                <zm:currentResultUrl var="actionUrl" value="${context_url}" context="${context}" action="view" id="${contact.id}"/>
                <div class="View">
                <form id="actions" action="${fn:escapeXml(actionUrl)}" method="post">
                        <input type="hidden" name="doContactAction" value="1"/>
                        <input type="hidden" name="crumb" value="${fn:escapeXml(mailbox.accountInfo.crumb)}"/>
                        <script>document.write('<input name="moreActions" type="hidden" value="<fmt:message key="actionGo"/>"/>');</script>
                                <%--<tr>
                                    <td align="right"><a href="#top">&nbsp;^&nbsp;</a></td>
                                </tr>--%>
                    <table cellspacing="2" cellpadding="2" width="100%">
                    <tr class="zo_m_list_row">
                   <td>
                       <input type="button" onclick="zClickLink('_edit_link')"
                                           value="<fmt:message key="edit"/>"/>
                        <c:choose>
                            <c:when test="${not context.folder.isInTrash}">
                                <input name="actionDelete" type="submit" value="<fmt:message key="delete"/>"/>
                            </c:when>
                            <c:otherwise>
                                <input name="actionHardDelete" type="submit" value="<fmt:message key="delete"/>"/>
                            </c:otherwise>
                        </c:choose>

                       <select name="anAction" onchange="document.getElementById('actions').submit();">
                               <option value="" selected="selected"><fmt:message key="moreActions"/></option>
                               <optgroup label="Flag">
                                    <c:if test="${not contact.isFlagged}">
                                        <option value="actionFlag">Add</option>
                                    </c:if>
                                   <c:if test="${contact.isFlagged}">
                                        <option value="actionUnflag">Remove</option>
                                   </c:if>
                              </optgroup>
                              <optgroup label="<fmt:message key="moveAction"/>">
                                <zm:forEachFolder var="folder">
                                    <c:if test="${folder.id != context.folder.id and folder.isContactMoveTarget and !folder.isTrash and !folder.isSpam}">
                                        <option value="moveTo_${folder.id}">${fn:escapeXml(folder.rootRelativePath)}</option>
                                    </c:if>
                                </zm:forEachFolder>
                              </optgroup>
                             <%-- <zm:forEachFolder var="folder">
                                  <input type="hidden" name="folderId" value="${folder.id}"/>
                              </zm:forEachFolder>--%>
                               <c:if test="${mailbox.features.tagging and mailbox.hasTags}">
                               <c:set var="tagsToAdd" value="${zm:getAvailableTags(pageContext,contact.tagIds,true)}"/>
                               <c:set var="tagsToRemove" value="${zm:getAvailableTags(pageContext,contact.tagIds,false)}"/>

                               <optgroup label="<fmt:message key="MO_actionAddTag"/>">
                                <c:forEach var="atag" items="${tagsToAdd}">
                                <option value="addTag_${atag.id}">${fn:escapeXml(atag.name)}</option>
                                </c:forEach>
                               </optgroup>
                               <optgroup label="<fmt:message key="MO_actionRemoveTag"/>">
                                <c:forEach var="atag" items="${tagsToRemove}">
                                <option value="remTag_${atag.id}">${fn:escapeXml(atag.name)}</option>
                                </c:forEach>
                               </optgroup>
                               </c:if>
                           </select>
                           <noscript><input name="moreActions" type="submit" value="<fmt:message key="actionGo"/>"/></noscript>
                        </td>
                </tr>
            </table>
                    </form>
            	</div>
            </td>
        </tr>
    </table>
</mo:view>
