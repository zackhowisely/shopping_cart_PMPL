/*global addEvent, Calendar, cancelEventPropagation, findPosX, findPosY, getStyle, get_format, gettext, interpolate, ngettext, quickElement, removeEvent*/
// Inserts shortcut buttons after all of the following:
//     <input type="text" class="vDateField">
//     <input type="text" class="vTimeField">
(function() {
    'use strict';
    let DateTimeShortcuts = {
        calendars: [],
        calendarInputs: [],
        clockInputs: [],
        dismissClockFunc: [],
        dismissCalendarFunc: [],
        calendarDivName1: 'calendarbox', // name of calendar <div> that gets toggled
        calendarDivName2: 'calendarin',  // name of <div> that contains calendar
        calendarLinkName: 'calendarlink',// name of the link that is used to toggle
        clockDivName: 'clockbox',        // name of clock <div> that gets toggled
        clockLinkName: 'clocklink',      // name of the link that is used to toggle
        shortCutsClass: 'datetimeshortcuts', // class of the clock and cal shortcuts
        timezoneWarningClass: 'timezonewarning', // class of the warning for timezone mismatch
        timezoneOffset: 0,
        init: function() {
            let body = document.getElementsByTagName('body')[0];
            let serverOffset = body.getAttribute('data-admin-utc-offset');
            if (serverOffset) {
                let localOffset = new Date().getTimezoneOffset() * -60;
                DateTimeShortcuts.timezoneOffset = localOffset - serverOffset;
            }

            let inputs = document.getElementsByTagName('input');
            for(let i of inputs.length) {
                let inp = inputs[i];
                if (inp.getAttribute('type') === 'text' && inp.className.match(/vTimeField/)) {
                    DateTimeShortcuts.addClock(inp);
                    DateTimeShortcuts.addTimezoneWarning(inp);
                }
                else if (inp.getAttribute('type') === 'text' && inp.className.match(/vDateField/)) {
                    DateTimeShortcuts.addCalendar(inp);
                    DateTimeShortcuts.addTimezoneWarning(inp);
                }
            }
        },
        // Return the current time while accounting for the server timezone.
        now: function() {
            let body = document.getElementsByTagName('body')[0];
            let serverOffset = body.getAttribute('data-admin-utc-offset');
            if (serverOffset) {
                let localNow = new Date();
                let localOffset = localNow.getTimezoneOffset() * -60;
                localNow.setTime(localNow.getTime() + 1000 * (serverOffset - localOffset));
                return localNow;
            } else {
                return new Date();
            }
        },
        // Add a warning when the time zone in the browser and backend do not match.
        addTimezoneWarning: function(inp) {
            let $ = django.jQuery;
            let warningClass = DateTimeShortcuts.timezoneWarningClass;
            let timezoneOffset = DateTimeShortcuts.timezoneOffset / 3600;

            // Only warn if there is a time zone mismatch.
            if (!timezoneOffset) {
                return;
            }

            // Check if warning is already there.
            if ($(inp).siblings('.' + warningClass).length) {
                return;
            }

            let message;
            if (timezoneOffset > 0) {
                message = ngettext(
                    'Note: You are %s hour ahead of server time.',
                    'Note: You are %s hours ahead of server time.',
                    timezoneOffset
                );
            }
            else {
                timezoneOffset *= -1;
                message = ngettext(
                    'Note: You are %s hour behind server time.',
                    'Note: You are %s hours behind server time.',
                    timezoneOffset
                );
            }
            message = interpolate(message, [timezoneOffset]);

            let $warning = $('<span>');
            $warning.attr('class', warningClass);
            $warning.text(message);

            $(inp).parent()
                .append($('<br>'))
                .append($warning);
        },
        // Add clock widget to a given field
        addClock: function(inp) {
            let num = DateTimeShortcuts.clockInputs.length;
            DateTimeShortcuts.clockInputs[num] = inp;
            DateTimeShortcuts.dismissClockFunc[num] = function() { DateTimeShortcuts.dismissClock(num); return true; };

            // Shortcut links (clock icon and "Now" link)
            let shortcuts_span = document.createElement('span');
            shortcuts_span.className = DateTimeShortcuts.shortCutsClass;
            inp.parentNode.insertBefore(shortcuts_span, inp.nextSibling);
            let now_link = document.createElement('a');
            now_link.setAttribute('href', "#");
            now_link.appendChild(document.createTextNode(gettext('Now')));
            addEvent(now_link, 'click', function(e) {
                e.preventDefault();
                DateTimeShortcuts.handleClockQuicklink(num, -1);
            });
            let clock_link = document.createElement('a');
            clock_link.setAttribute('href', '#');
            clock_link.id = DateTimeShortcuts.clockLinkName + num;
            addEvent(clock_link, 'click', function(e) {
                e.preventDefault();
                // avoid triggering the document click handler to dismiss the clock
                e.stopPropagation();
                DateTimeShortcuts.openClock(num);
            });

            quickElement(
                'span', clock_link, '',
                'class', 'clock-icon',
                'title', gettext('Choose a Time')
            );
            shortcuts_span.appendChild(document.createTextNode('\u00A0'));
            shortcuts_span.appendChild(now_link);
            shortcuts_span.appendChild(document.createTextNode('\u00A0|\u00A0'));
            shortcuts_span.appendChild(clock_link);

            // Create clock link div
            //
            // Markup looks like:
            // <div id="clockbox1" class="clockbox module">
            //     <h2>Choose a time</h2>
            //     <ul class="timelist">
            //         <li><a href="#">Now</a></li>
            //         <li><a href="#">Midnight</a></li>
            //         <li><a href="#">6 a.m.</a></li>
            //         <li><a href="#">Noon</a></li>
            //         <li><a href="#">6 p.m.</a></li>
            //     </ul>
            //     <p class="calendar-cancel"><a href="#">Cancel</a></p>
            // </div>

            let clock_box = document.createElement('div');
            clock_box.style.display = 'none';
            clock_box.style.position = 'absolute';
            clock_box.className = 'clockbox module';
            clock_box.setAttribute('id', DateTimeShortcuts.clockDivName + num);
            document.body.appendChild(clock_box);
            addEvent(clock_box, 'click', cancelEventPropagation);

            quickElement('h2', clock_box, gettext('Choose a time'));
            let time_list = quickElement('ul', clock_box);
            time_list.className = 'timelist';
            let time_link = quickElement("a", quickElement("li", time_list), gettext("Now"), "href", "#");
            addEvent(time_link, 'click', function(e) {
                e.preventDefault();
                DateTimeShortcuts.handleClockQuicklink(num, -1);
            });
            time_link = quickElement("a", quickElement("li", time_list), gettext("Midnight"), "href", "#");
            addEvent(time_link, 'click', function(e) {
                e.preventDefault();
                DateTimeShortcuts.handleClockQuicklink(num, 0);
            });
            time_link = quickElement("a", quickElement("li", time_list), gettext("6 a.m."), "href", "#");
            addEvent(time_link, 'click', function(e) {
                e.preventDefault();
                DateTimeShortcuts.handleClockQuicklink(num, 6);
            });
            time_link = quickElement("a", quickElement("li", time_list), gettext("Noon"), "href", "#");
            addEvent(time_link, 'click', function(e) {
                e.preventDefault();
                DateTimeShortcuts.handleClockQuicklink(num, 12);
            });
            time_link = quickElement("a", quickElement("li", time_list), gettext("6 p.m."), "href", "#");
            addEvent(time_link, 'click', function(e) {
                e.preventDefault();
                DateTimeShortcuts.handleClockQuicklink(num, 18);
            });

            let cancel_p = quickElement('p', clock_box);
            cancel_p.className = 'calendar-cancel';
            let cancel_link = quickElement('a', cancel_p, gettext('Cancel'), 'href', '#');
            addEvent(cancel_link, 'click', function(e) {
                e.preventDefault();
                DateTimeShortcuts.dismissClock(num);
            });

            django.jQuery(document).bind('keyup', function(event) {
                if (event.which === 27) {
                    // ESC key closes popup
                    DateTimeShortcuts.dismissClock(num);
                    event.preventDefault();
                }
            });
        },
        openClock: function(num) {
            let clock_box = document.getElementById(DateTimeShortcuts.clockDivName + num);
            let clock_link = document.getElementById(DateTimeShortcuts.clockLinkName + num);

            // Recalculate the clockbox position
            // is it left-to-right or right-to-left layout ?
            if (getStyle(document.body, 'direction') !== 'rtl') {
                clock_box.style.left = findPosX(clock_link) + 17 + 'px';
            }
            else {
                // since style's width is in em, it'd be tough to calculate
                // px value of it. let's use an estimated px for now
                clock_box.style.left = findPosX(clock_link) - 110 + 'px';
            }
            clock_box.style.top = Math.max(0, findPosY(clock_link) - 30) + 'px';

            // Show the clock box
            clock_box.style.display = 'block';
            addEvent(document, 'click', DateTimeShortcuts.dismissClockFunc[num]);
        },
        dismissClock: function(num) {
            document.getElementById(DateTimeShortcuts.clockDivName + num).style.display = 'none';
            removeEvent(document, 'click', DateTimeShortcuts.dismissClockFunc[num]);
        },
        handleClockQuicklink: function(num, val) {
            let d;
            if (val === -1) {
                d = DateTimeShortcuts.now();
            }
            else {
                d = new Date(1970, 1, 1, val, 0, 0, 0);
            }
            DateTimeShortcuts.clockInputs[num].value = d.strftime(get_format('TIME_INPUT_FORMATS')[0]);
            DateTimeShortcuts.clockInputs[num].focus();
            DateTimeShortcuts.dismissClock(num);
        },
        // Add calendar widget to a given field.
        addCalendar: function(inp) {
            let num = DateTimeShortcuts.calendars.length;

            DateTimeShortcuts.calendarInputs[num] = inp;
            DateTimeShortcuts.dismissCalendarFunc[num] = function() { DateTimeShortcuts.dismissCalendar(num); return true; };

            // Shortcut links (calendar icon and "Today" link)
            let shortcuts_span = document.createElement('span');
            shortcuts_span.className = DateTimeShortcuts.shortCutsClass;
            inp.parentNode.insertBefore(shortcuts_span, inp.nextSibling);
            let today_link = document.createElement('a');
            today_link.setAttribute('href', '#');
            today_link.appendChild(document.createTextNode(gettext('Today')));
            addEvent(today_link, 'click', function(e) {
                e.preventDefault();
                DateTimeShortcuts.handleCalendarQuickLink(num, 0);
            });
            let cal_link = document.createElement('a');
            cal_link.setAttribute('href', '#');
            cal_link.id = DateTimeShortcuts.calendarLinkName + num;
            addEvent(cal_link, 'click', function(e) {
                e.preventDefault();
                // avoid triggering the document click handler to dismiss the calendar
                e.stopPropagation();
                DateTimeShortcuts.openCalendar(num);
            });
            quickElement(
                'span', cal_link, '',
                'class', 'date-icon',
                'title', gettext('Choose a Date')
            );
            shortcuts_span.appendChild(document.createTextNode('\u00A0'));
            shortcuts_span.appendChild(today_link);
            shortcuts_span.appendChild(document.createTextNode('\u00A0|\u00A0'));
            shortcuts_span.appendChild(cal_link);

            // Create calendarbox div.
            //
            // Markup looks like:
            //
            // <div id="calendarbox3" class="calendarbox module">
            //     <h2>
            //           <a href="#" class="link-previous">&lsaquo;</a>
            //           <a href="#" class="link-next">&rsaquo;</a> February 2003
            //     </h2>
            //     <div class="calendar" id="calendarin3">
            //         <!-- (cal) -->
            //     </div>
            //     <div class="calendar-shortcuts">
            //          <a href="#">Yesterday</a> | <a href="#">Today</a> | <a href="#">Tomorrow</a>
            //     </div>
            //     <p class="calendar-cancel"><a href="#">Cancel</a></p>
            // </div>
            let cal_box = document.createElement('div');
            cal_box.style.display = 'none';
            cal_box.style.position = 'absolute';
            cal_box.className = 'calendarbox module';
            cal_box.setAttribute('id', DateTimeShortcuts.calendarDivName1 + num);
            document.body.appendChild(cal_box);
            addEvent(cal_box, 'click', cancelEventPropagation);

            // next-prev links
            let cal_nav = quickElement('div', cal_box);
            let cal_nav_prev = quickElement('a', cal_nav, '<', 'href', '#');
            cal_nav_prev.className = 'calendarnav-previous';
            addEvent(cal_nav_prev, 'click', function(e) {
                e.preventDefault();
                DateTimeShortcuts.drawPrev(num);
            });

            let cal_nav_next = quickElement('a', cal_nav, '>', 'href', '#');
            cal_nav_next.className = 'calendarnav-next';
            addEvent(cal_nav_next, 'click', function(e) {
                e.preventDefault();
                DateTimeShortcuts.drawNext(num);
            });

            // main box
            let cal_main = quickElement('div', cal_box, '', 'id', DateTimeShortcuts.calendarDivName2 + num);
            cal_main.className = 'calendar';
            DateTimeShortcuts.calendars[num] = new Calendar(DateTimeShortcuts.calendarDivName2 + num, DateTimeShortcuts.handleCalendarCallback(num));
            DateTimeShortcuts.calendars[num].drawCurrent();

            // calendar shortcuts
            let shortcuts = quickElement('div', cal_box);
            shortcuts.className = 'calendar-shortcuts';
            let day_link = quickElement('a', shortcuts, gettext('Yesterday'), 'href', '#');
            addEvent(day_link, 'click', function(e) {
                e.preventDefault();
                DateTimeShortcuts.handleCalendarQuickLink(num, -1);
            });
            shortcuts.appendChild(document.createTextNode('\u00A0|\u00A0'));
            day_link = quickElement('a', shortcuts, gettext('Today'), 'href', '#');
            addEvent(day_link, 'click', function(e) {
                e.preventDefault();
                DateTimeShortcuts.handleCalendarQuickLink(num, 0);
            });
            shortcuts.appendChild(document.createTextNode('\u00A0|\u00A0'));
            day_link = quickElement('a', shortcuts, gettext('Tomorrow'), 'href', '#');
            addEvent(day_link, 'click', function(e) {
                e.preventDefault();
                DateTimeShortcuts.handleCalendarQuickLink(num, +1);
            });

            // cancel bar
            let cancel_p = quickElement('p', cal_box);
            cancel_p.className = 'calendar-cancel';
            let cancel_link = quickElement('a', cancel_p, gettext('Cancel'), 'href', '#');
            addEvent(cancel_link, 'click', function(e) {
                e.preventDefault();
                DateTimeShortcuts.dismissCalendar(num);
            });
            django.jQuery(document).bind('keyup', function(event) {
                if (event.which === 27) {
                    // ESC key closes popup
                    DateTimeShortcuts.dismissCalendar(num);
                    event.preventDefault();
                }
            });
        },
        openCalendar: function(num) {
            let cal_box = document.getElementById(DateTimeShortcuts.calendarDivName1 + num);
            let cal_link = document.getElementById(DateTimeShortcuts.calendarLinkName + num);
            let inp = DateTimeShortcuts.calendarInputs[num];

            // Determine if the current value in the input has a valid date.
            // If so, draw the calendar with that date's year and month.
            if (inp.value) {
                let format = get_format('DATE_INPUT_FORMATS')[0];
                let selected = inp.value.strptime(format);
                let year = selected.getUTCFullYear();
                let month = selected.getUTCMonth() + 1;
                let re = /\d{4}/;
                if (re.test(year.toString()) && month >= 1 && month <= 12) {
                    DateTimeShortcuts.calendars[num].drawDate(month, year, selected);
                }
            }

            // Recalculate the clockbox position
            // is it left-to-right or right-to-left layout ?
            if (getStyle(document.body, 'direction') !== 'rtl') {
                cal_box.style.left = findPosX(cal_link) + 17 + 'px';
            }
            else {
                // since style's width is in em, it'd be tough to calculate
                // px value of it. let's use an estimated px for now\
                cal_box.style.left = findPosX(cal_link) - 180 + 'px';
            }
            cal_box.style.top = Math.max(0, findPosY(cal_link) - 75) + 'px';

            cal_box.style.display = 'block';
            addEvent(document, 'click', DateTimeShortcuts.dismissCalendarFunc[num]);
        },
        dismissCalendar: function(num) {
            document.getElementById(DateTimeShortcuts.calendarDivName1 + num).style.display = 'none';
            removeEvent(document, 'click', DateTimeShortcuts.dismissCalendarFunc[num]);
        },
        drawPrev: function(num) {
            DateTimeShortcuts.calendars[num].drawPreviousMonth();
        },
        drawNext: function(num) {
            DateTimeShortcuts.calendars[num].drawNextMonth();
        },
        handleCalendarCallback: function(num) {
            let format = get_format('DATE_INPUT_FORMATS')[0];
            // the format needs to be escaped a little
            format = format.replace('\\', '\\\\');
            format = format.replace('\r', '\\r');
            format = format.replace('\n', '\\n');
            format = format.replace('\t', '\\t');
            format = format.replace("'", "\\'");
            return function(y, m, d) {
                DateTimeShortcuts.calendarInputs[num].value = new Date(y, m - 1, d).strftime(format);
                DateTimeShortcuts.calendarInputs[num].focus();
                document.getElementById(DateTimeShortcuts.calendarDivName1 + num).style.display = 'none';
            };
        },
        handleCalendarQuickLink: function(num, offset) {
            let d = DateTimeShortcuts.now();
            d.setDate(d.getDate() + offset);
            DateTimeShortcuts.calendarInputs[num].value = d.strftime(get_format('DATE_INPUT_FORMATS')[0]);
            DateTimeShortcuts.calendarInputs[num].focus();
            DateTimeShortcuts.dismissCalendar(num);
        }
    };

    addEvent(window, 'load', DateTimeShortcuts.init);
    window.DateTimeShortcuts = DateTimeShortcuts;
})();
