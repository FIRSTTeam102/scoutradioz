"use strict";
$(function () {
    $('#toggleStickyToggle').addClass('animate');
    $('#toggleSticky').on('change', () => {
        var enabled = $('#toggleSticky').prop('checked');
        window.stickyBarEnabled = enabled;
        if (enabled) {
            $('#stickyBar').show().css('bottom', -60).animate({
                'bottom': 0
            }, 200);
            localStorage.removeItem('disableStickyBar');
        }
        else {
            $('#stickyBar').animate({
                'bottom': -60
            }, 200);
            $('.disabled-form').removeClass('disabled-form').removeAttr('disabled')
                .find('input, button').removeAttr('disabled');
            localStorage.setItem('disableStickyBar', '1');
        }
    });
    var headerElements = [];
    for (let label of window.headerList) {
        let thisHeader = $(`#${label}`);
        if (thisHeader[0])
            headerElements.push(thisHeader[0]);
    }
    const stickyBarTitle = $('#stickyBarTitle');
    const stickyBarLeft = $('#stickyBarLeft');
    const stickyBarRight = $('#stickyBarRight');
    var currentHeaderID = '';
    handleScroll();
    var ticking = false;
    $(window).on('scroll', () => {
        if (!ticking) {
            requestAnimationFrame(() => {
                handleScroll();
                ticking = false;
            });
        }
        ticking = true;
    });
    function handleScroll() {
        if (!window.stickyBarEnabled)
            return;
        for (let header of headerElements) {
            let isVisible = checkVisible(header);
            if (isVisible) {
                if (currentHeaderID !== header.id) {
                    setStickyBar(header.id, header.innerText);
                }
                break;
            }
        }
    }
    function setStickyBar(id, text) {
        let st = performance.now();
        stickyBarTitle.text(text);
        currentHeaderID = id;
        for (let i = 0; i < headerElements.length; i++) {
            let header = headerElements[i];
            let nextHeader = headerElements[i + 1];
            let thisSibling = header.nextElementSibling;
            if (header.id === id) {
                header.classList.remove('disabled-form');
                while (thisSibling && thisSibling !== nextHeader) {
                    thisSibling.classList.remove('disabled-form');
                    let thisSibInputs = thisSibling.querySelectorAll('input, button');
                    if (thisSibInputs)
                        thisSibInputs.forEach(itm => itm.disabled = false);
                    else
                        thisSibling.disabled = false;
                    thisSibling = thisSibling.nextElementSibling;
                }
            }
            else {
                header.classList.add('disabled-form');
                while (thisSibling && thisSibling !== nextHeader) {
                    thisSibling.classList.add('disabled-form');
                    let thisSibInputs = thisSibling.querySelectorAll('input, button');
                    if (thisSibInputs)
                        thisSibInputs.forEach(itm => itm.disabled = true);
                    else
                        thisSibling.disabled = true;
                    thisSibling = thisSibling.nextElementSibling;
                }
            }
        }
        console.log(performance.now() - st);
    }
    stickyBarLeft.on('click', () => {
        let currentHeader = document.getElementById(currentHeaderID);
        if (!currentHeader)
            throw new Error(`Header ${currentHeaderID} not found`);
        let index = headerElements.indexOf(currentHeader);
        let prevHeader = headerElements[index - 1];
        if (prevHeader) {
            window.scrollToId('dynamicscroll_' + prevHeader.id);
        }
    });
    stickyBarRight.on('click', () => {
        let currentHeader = document.getElementById(currentHeaderID);
        if (!currentHeader)
            throw new Error(`Header ${currentHeaderID} not found`);
        let index = headerElements.indexOf(currentHeader);
        let nextHeader = headerElements[index + 1];
        if (nextHeader) {
            window.scrollToId('dynamicscroll_' + nextHeader.id);
        }
    });
    stickyBarLeft.on('mousedown', fancyMouseDown);
    stickyBarLeft.on('touchstart', fancyMouseDown);
    stickyBarRight.on('mousedown', fancyMouseDown);
    stickyBarRight.on('touchstart', fancyMouseDown);
    stickyBarLeft.on('mouseup', fancyMouseUp);
    stickyBarLeft.on('touchend', fancyMouseUp);
    stickyBarRight.on('mouseup', fancyMouseUp);
    stickyBarRight.on('touchend', fancyMouseUp);
    function fancyMouseDown() {
        $(this).css({
            top: 2,
            left: 2,
        });
    }
    function fancyMouseUp() {
        $(this).css({
            top: '',
            left: '',
        });
    }
    function checkVisible(elem) {
        var rect = elem.getBoundingClientRect();
        var viewHeight = Math.max(document.documentElement.clientHeight, window.innerHeight);
        return !(rect.bottom < 0 || rect.top - viewHeight >= 0);
    }
    window.onResize(() => {
        if (!window.stickyBarEnabled)
            return;
        let triLeft = $('#stickyBarLeft')[0];
        let text = $('#stickyBarTitle')[0];
        const OFFSET = -8;
        text.style.fontSize = '1em';
        let triRect = triLeft.getBoundingClientRect();
        let iterations = 0, textSize = 1;
        while (iterations < 10 && text.getBoundingClientRect().left < triRect.right + OFFSET) {
            textSize -= 0.05;
            text.style.fontSize = textSize + 'em';
            iterations++;
        }
    });
});
$(function () {
    $('#submit').on('click', function () {
        $('input[disabled]').removeAttr('disabled');
        var matchForm = $('form[name=matchform]');
        var matchSubmission = new FormSubmission(matchForm, '/scouting/match/submit', 'matchScouting');
        matchSubmission.submit((err, response) => {
            let message = response.message;
            if (err || !message) {
                NotificationCard.error('An error occurred. Please retry.');
            }
            else {
                NotificationCard.show(message, { darken: true, type: 'good', ttl: 0 });
                let newHref = (response.assigned) ? '/dashboard' : '/dashboard/matches';
                setTimeout(() => {
                    window.onbeforeunload = null;
                    window.location.href = newHref;
                }, 1000);
            }
        });
        window.onbeforeunload = function () {
            return 'Leaving this page will lose match scouting data.';
        };
    });
});
