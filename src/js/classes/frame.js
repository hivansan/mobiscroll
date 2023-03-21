import { $, extend, Base, mobiscroll, classes } from '../core/core';
import { os, majorVersion, isBrowser, userAgent } from '../util/platform';
import { animEnd, closest, listen, unlisten } from '../util/dom';
import { getCoord, preventClick, tapOff } from '../util/tap';
import { constrain, isString, noop } from '../util/misc';
import { resizeObserver } from '../util/resize-observer';

var $activeElm,
    preventShow,
    themes = mobiscroll.themes,
    needsFixed = /(iphone|ipod)/i.test(userAgent) && majorVersion >= 7,
    isAndroid = os == 'android',
    isIOS = os == 'ios',
    isIOS8 = isIOS && majorVersion == 8,
    halfBorder = isIOS && majorVersion > 7,
    prevdef = function (ev) {
        ev.preventDefault();
    };

const EDITABLE = 'input,select,textarea,button';
const ALLOW_ENTER = 'textarea,button,input[type="button"],input[type="submit"]';
const FOCUSABLE = EDITABLE + ',[tabindex="0"]';

export const Frame = function (el, settings, inherit) {
    var //$ariaDiv,
        $ctx,
        $header,
        $lock,
        $markup,
        $overlay,
        $persp,
        $popup,
        $wnd,
        $wrapper,
        buttons,
        btn,
        ctx,
        doAnim,
        hasContext,
        isModal,
        isInserted,
        isPointer,
        markup,
        modalWidth,
        modalHeight,
        needsDimensions,
        needsLock,
        observer,
        overlay,
        popup,
        posDebounce,
        prevInst,
        s,
        scrollLock,
        touched,
        trigger,
        wndWidth,
        wndHeight,

        that = this,
        $elm = $(el),
        elmList = [],
        lastFocus = new Date();

    function onBtnStart(ev) {
        // Need this to prevent opening of sidemenus or similar
        if (s.stopProp) {
            ev.stopPropagation();
        }

        var b = closest(this, ev.target, '.mbsc-fr-btn-e');

        if (!b) {
            return;
        }

        // Can't call preventDefault here, it kills page scroll
        if (btn) {
            btn.removeClass('mbsc-active');
        }

        btn = $(b);

        // Active button
        if (!btn.hasClass('mbsc-disabled') && !btn.hasClass('mbsc-fr-btn-nhl')) {
            btn.addClass('mbsc-active');
        }

        if (ev.type === 'mousedown') {
            $(document).on('mouseup', onBtnEnd);
        }
    }

    function onBtnEnd(ev) {
        if (btn) {
            btn.removeClass('mbsc-active');
            btn = null;
        }

        if (ev.type === 'mouseup') {
            $(document).off('mouseup', onBtnEnd);
        }
    }

    function onScroll(ev) {
        if (scrollLock && markup.contains(ev.target)) {
            ev.preventDefault();
        }
    }

    function onWndKeyDown(ev) {
        if (mobiscroll.activeInstance == that) {
            if (ev.keyCode == 13 && (!$(ev.target).is(ALLOW_ENTER) || ev.shiftKey)) {
                that.select();
            } else if (ev.keyCode == 27) {
                that.cancel();
            }
        }
    }

    function onShow(prevFocus) {
        if (!prevFocus && !isAndroid && that._activeElm) {
            //overlay.focus();
            lastFocus = new Date();
            that._activeElm.focus();
        }
        //that.ariaMessage(s.ariaMessage);
    }

    function onHide(prevAnim) {
        var $activeEl = $activeElm,
            focus = s.focusOnClose;

        that._markupRemove();

        $markup.remove();

        if (isModal) {
            ctx.mbscModals--;

            if (s.scrollLock) {
                ctx.mbscLock--;
            }

            if (!ctx.mbscLock) {
                $lock.removeClass('mbsc-fr-lock');
            }

            if (needsLock) {
                ctx.mbscIOSLock--;
                if (!ctx.mbscIOSLock) {
                    $lock.removeClass('mbsc-fr-lock-ios');
                    $ctx.css({ top: '', left: '' });
                    $wnd.scrollLeft(ctx.mbscScrollLeft);
                    $wnd.scrollTop(ctx.mbscScrollTop);
                }
            }

            // The follwing should be done only if no other
            // instance was opened during the hide animation
            if (!ctx.mbscModals) {
                $lock.removeClass('mbsc-fr-lock-ctx');
            }

            if (!ctx.mbscModals || prevInst) {
                // Put focus back to the last active element
                if (!prevAnim) {
                    if (!$activeEl) {
                        $activeEl = $elm;
                    }
                    setTimeout(function () {
                        if (focus === undefined || focus === true) {
                            preventShow = true;
                            $activeEl[0].focus();
                        } else if (focus) {
                            $(focus)[0].focus();
                        }
                    }, 200);
                }
            }
        }

        prevInst = undefined;
        isInserted = false;

        trigger('onHide');
    }

    function onPosition() {
        clearTimeout(posDebounce);
        posDebounce = setTimeout(function () {
            if (that.position(true)) {
                // Trigger reflow, needed on iOS safari, when orientation is changed
                popup.style.visibility = 'hidden';
                popup.offsetHeight;
                popup.style.visibility = '';
            }
        }, 200);
    }

    function onFocus(ev) {
        if (mobiscroll.activeInstance == that && ev.target.nodeType && !overlay.contains(ev.target) && new Date() - lastFocus > 100) {
            lastFocus = new Date();
            that._activeElm.focus();
        }
    }

    function insertMarkup(prevAnim, prevFocus) {

        function onAnimEnd() {
            $markup
                .off(animEnd, onAnimEnd)
                .removeClass('mbsc-anim-in mbsc-anim-trans mbsc-anim-trans-' + doAnim)
                .find('.mbsc-fr-popup')
                .removeClass('mbsc-anim-' + doAnim);
            onShow(prevFocus);
        }

        function onOverlayStart(ev) {
            if (!target && ev.target == overlay) {
                target = true;
                moved = false;
                startX = getCoord(ev, 'X');
                startY = getCoord(ev, 'Y');
            }
        }

        function onOverlayMove(ev) {
            if (target && !moved && (Math.abs(getCoord(ev, 'X') - startX) > 9 || Math.abs(getCoord(ev, 'Y') - startY) > 9)) {
                moved = true;
            }
        }

        // Might be not visible if immediately hidden
        if (!that._isVisible) {
            return;
        }

        // Show
        if (isModal) {
            $markup.appendTo($ctx);
        } else if ($elm.is('div') && !that._hasContent) {
            // Insert inside the element on which was initialized
            $elm.empty().append($markup);
        } else {
            // Insert after the element
            if ($elm.hasClass('mbsc-control')) {
                var $wrap = $elm.closest('.mbsc-control-w');
                $markup.insertAfter($wrap);
                if ($wrap.hasClass('mbsc-select')) {
                    $wrap.addClass('mbsc-select-inline');
                }
            } else {
                $markup.insertAfter($elm);
            }
        }

        isInserted = true;

        that._markupInserted($markup);

        trigger('onMarkupInserted', {
            target: markup
        });

        if (isModal && s.closeOnOverlayTap) {
            var moved,
                target,
                startX,
                startY;

            listen(overlay, 'touchstart', onOverlayStart, { passive: true });
            listen(overlay, 'touchmove', onOverlayMove, { passive: true });

            $overlay
                .on('mousedown', onOverlayStart)
                .on('mousemove', onOverlayMove)
                .on('touchcancel', function () {
                    target = false;
                })
                .on('touchend click', function (ev) {
                    if (target && !moved) {
                        that.cancel();
                        if (ev.type == 'touchend') {
                            preventClick();
                        }
                    }
                    target = false;
                });
        }

        $markup
            .on('mousedown', '.mbsc-btn-e,.mbsc-fr-btn-e', prevdef)
            .on('keydown', '.mbsc-fr-btn-e', function (ev) {
                if (ev.keyCode == 32) { // Space
                    ev.preventDefault();
                    ev.stopPropagation();
                    this.click();
                }
            })
            .on('keydown', function (ev) { // Trap focus inside modal
                if (ev.keyCode == 32 && !$(ev.target).is(EDITABLE)) {
                    // Prevent page scroll on space press
                    ev.preventDefault();
                } else if (ev.keyCode == 9 && isModal && s.focusTrap) { // Tab
                    var $focusable = $markup.find(FOCUSABLE).filter(function () {
                            return this.offsetWidth > 0 || this.offsetHeight > 0;
                        }),
                        index = $focusable.index($(':focus', $markup)),
                        i = $focusable.length - 1,
                        target = 0;

                    if (ev.shiftKey) {
                        i = 0;
                        target = -1;
                    }

                    if (index === i) {
                        $focusable.eq(target)[0].focus();
                        ev.preventDefault();
                    }
                }
            })
            .on('touchend', '.mbsc-fr-btn-e', onBtnEnd);

        listen(markup, 'touchstart', onBtnStart, { passive: true });
        listen(markup, 'mousedown', onBtnStart);

        // Need event capture for this
        listen(markup, 'touchstart', function () {
            if (!touched) {
                touched = true;
                $ctx.find('.mbsc-no-touch').removeClass('mbsc-no-touch');
            }
        }, { passive: true, capture: true });

        // Init buttons
        $.each(buttons, function (i, b) {
            that.tap($('.mbsc-fr-btn' + i, $markup), function (ev) {
                b = isString(b) ? that.buttons[b] : b;
                (isString(b.handler) ? that.handlers[b.handler] : b.handler).call(this, ev, that);
            }, true);
        });

        that._attachEvents($markup);

        // Set position
        if (that.position() === false) {
            return;
        }

        if (isModal || that._checkSize) {
            observer = resizeObserver(markup, onPosition, s.zone);
        }

        if (isModal) {
            $markup.removeClass('mbsc-fr-pos');
            if (doAnim && !prevAnim) {
                $markup
                    .addClass('mbsc-anim-in mbsc-anim-trans mbsc-anim-trans-' + doAnim)
                    .on(animEnd, onAnimEnd)
                    .find('.mbsc-fr-popup')
                    .addClass('mbsc-anim-' + doAnim);
            } else {
                onShow(prevFocus);
            }
        }

        trigger('onShow', {
            target: markup,
            valueText: that._tempValue
        });
    }

    function show(beforeShow, $elm) {
        if (that._isVisible) {
            return;
        }

        if (beforeShow) {
            beforeShow();
        }

        if (that.show() !== false) {
            $activeElm = $elm;
        }
    }

    function set() {
        that._fillValue();
        trigger('onSet', {
            valueText: that._value
        });
    }

    function cancel() {
        trigger('onCancel', {
            valueText: that._value
        });
    }

    function clear() {
        that.setVal(null, true);
    }

    // Call the parent constructor
    Base.call(this, el, settings, true);

    /**
     * Positions the scroller on the screen.
     */
    that.position = function (check) {
        var anchor,
            anchorWidth,
            anchorHeight,
            anchorPos,
            anchorTop,
            anchorLeft,
            arrow,
            arrowWidth,
            arrowHeight,
            docHeight,
            docWidth,
            isWrapped,
            newHeight,
            newWidth,
            oldHeight,
            oldWidth,
            width,
            top,
            left,
            css = {},
            scrollLeft = 0,
            scrollTop = 0,
            minWidth = 0,
            totalWidth = 0;

        if (!isInserted) {
            return false;
        }

        oldWidth = wndWidth;
        oldHeight = wndHeight;
        newHeight = Math.min(markup.offsetHeight, hasContext ? Infinity : window.innerHeight);
        newWidth = Math.min(markup.offsetWidth, hasContext ? Infinity : window.innerWidth);

        if (!newWidth || !newHeight || (wndWidth === newWidth && wndHeight === newHeight && check)) {
            return;
        }

        if (that._checkResp(newWidth)) {
            return false;
        }

        wndWidth = newWidth;
        wndHeight = newHeight;

        if (that._isFullScreen || /top|bottom/.test(s.display)) {
            // Set width, if document is larger than viewport, needs to be set before onPosition (for calendar)
            $popup.width(newWidth);
        } else if (isModal) {
            // Reset width
            $wrapper.width('');
        }

        that._position($markup);

        // Call position for nested mobiscroll components
        // $('.mbsc-comp', $markup).each(function () {
        //     var inst = instances[this.id];
        //     if (inst && inst !== that && inst.position) {
        //         inst.position();
        //     }
        // });

        if (!that._isFullScreen && /center|bubble/.test(s.display)) {
            $('.mbsc-w-p', $markup).each(function () {
                // Need fractional values here, so offsetWidth is not ok
                width = this.getBoundingClientRect().width;
                totalWidth += width;
                minWidth = (width > minWidth) ? width : minWidth;
            });

            isWrapped = totalWidth > (newWidth - 16) || s.tabs === true;

            $wrapper.css({
                'width': that._isLiquid ? Math.min(s.maxPopupWidth, newWidth - 16) : Math.ceil(isWrapped ? minWidth : totalWidth),
                'white-space': isWrapped ? '' : 'nowrap'
            });
        }

        if (trigger('onPosition', {
                target: markup,
                popup: popup,
                hasTabs: isWrapped,
                oldWidth: oldWidth,
                oldHeight: oldHeight,
                windowWidth: newWidth,
                windowHeight: newHeight
            }) === false || !isModal) {
            return;
        }

        if (needsDimensions) {
            scrollLeft = $wnd.scrollLeft();
            scrollTop = $wnd.scrollTop();
            if (wndWidth) {
                $persp.css({ width: '', height: '' });
            }
        }

        modalWidth = popup.offsetWidth;
        modalHeight = popup.offsetHeight;

        scrollLock = modalHeight <= newHeight && modalWidth <= newWidth;

        if (s.display == 'center') {
            left = Math.max(0, scrollLeft + (newWidth - modalWidth) / 2);
            top = Math.max(0, scrollTop + (newHeight - modalHeight) / 2);
        } else if (s.display == 'bubble') {
            anchor = s.anchor === undefined ? $elm : $(s.anchor);

            arrow = $('.mbsc-fr-arr-i', $markup)[0];
            anchorPos = anchor.offset();
            anchorTop = anchorPos.top + (hasContext ? scrollTop - $ctx.offset().top : 0);
            anchorLeft = anchorPos.left + (hasContext ? scrollLeft - $ctx.offset().left : 0);

            anchorWidth = anchor[0].offsetWidth;
            anchorHeight = anchor[0].offsetHeight;

            arrowWidth = arrow.offsetWidth;
            arrowHeight = arrow.offsetHeight;

            // Horizontal positioning
            left = constrain(anchorLeft - (modalWidth - anchorWidth) / 2, scrollLeft + 3, scrollLeft + newWidth - modalWidth - 3);

            // Vertical positioning
            // Below the input
            top = anchorTop + anchorHeight + arrowHeight / 2;
            if ((top + modalHeight + 8 > scrollTop + newHeight) && (anchorTop - modalHeight - arrowHeight / 2 > scrollTop)) {
                $popup.removeClass('mbsc-fr-bubble-bottom').addClass('mbsc-fr-bubble-top');
                // Above the input
                top = anchorTop - modalHeight - arrowHeight / 2;
            } else {
                $popup.removeClass('mbsc-fr-bubble-top').addClass('mbsc-fr-bubble-bottom');
            }

            // Set arrow position
            $('.mbsc-fr-arr', $markup).css({
                left: constrain(anchorLeft + anchorWidth / 2 - (left + (modalWidth - arrowWidth) / 2), 0, arrowWidth)
            });

            // Lock scroll only if popup is entirely in the viewport
            scrollLock = (top > scrollTop) && (left > scrollLeft) &&
                (top + modalHeight <= scrollTop + newHeight) && (left + modalWidth <= scrollLeft + newWidth);

        } else {
            left = scrollLeft;
            top = s.display == 'top' ? scrollTop : Math.max(0, scrollTop + newHeight - modalHeight);
        }

        if (needsDimensions) {
            // If top + modal height > doc height, increase doc height
            docHeight = Math.max(top + modalHeight, hasContext ? ctx.scrollHeight : $(document).height());
            docWidth = Math.max(left + modalWidth, hasContext ? ctx.scrollWidth : $(document).width());
            $persp.css({ width: docWidth, height: docHeight });

            // Check if scroll needed
            if (s.scroll && s.display == 'bubble' && ((top + modalHeight + 8 > scrollTop + newHeight) || (anchorTop > scrollTop + newHeight) || (anchorTop + anchorHeight < scrollTop))) {
                $wnd.scrollTop(Math.min(anchorTop, top + modalHeight - newHeight + 8, docHeight - newHeight));
            }
        }

        css.top = Math.floor(top);
        css.left = Math.floor(left);

        $popup.css(css);

        return true;
    };

    /**
     * Show mobiscroll on focus and click event of the parameter.
     * @param {HTMLElement} elm - Events will be attached to this element.
     * @param {Function} [beforeShow=undefined] - Optional function to execute before showing mobiscroll.
     */
    that.attachShow = function (elm, beforeShow) {
        var $label,
            $elm = $(elm).off('.mbsc'),
            readOnly = $elm.prop('readonly');

        tapOff($elm);

        if (s.display !== 'inline') {
            if ((s.showOnFocus || s.showOnTap) && $elm.is('input,select')) {
                $elm.prop('readonly', true).on('mousedown.mbsc', function (ev) {
                    // Prevent input to get focus on tap (virtual keyboard pops up on some devices)
                    ev.preventDefault();
                }).on('focus.mbsc', function () {
                    if (that._isVisible) {
                        // Don't allow input focus if mobiscroll is being opened
                        this.blur();
                    }
                });

                $label = $('label[for="' + $elm.attr('id') + '"]');

                if (!$label.length) {
                    $label = $elm.closest('label');
                }
            }

            if (!$elm.is('select')) {
                if (s.showOnFocus) {
                    $elm.on('focus.mbsc', function () {
                        if (!preventShow) {
                            show(beforeShow, $elm);
                        } else {
                            preventShow = false;
                        }
                    });
                }

                if (s.showOnTap) {
                    $elm.on('keydown.mbsc', function (ev) {
                        if (ev.keyCode == 32 || ev.keyCode == 13) { // Space or Enter
                            ev.preventDefault();
                            ev.stopPropagation();
                            show(beforeShow, $elm);
                        }
                    });

                    that.tap($elm, function (ev) {
                        if (ev.isMbscTap) {
                            touched = true;
                        }
                        show(beforeShow, $elm);
                    });

                    if ($label && $label.length) {
                        tapOff($label);
                        that.tap($label, function (ev) {
                            ev.preventDefault();
                            if (ev.target !== $elm[0]) {
                                show(beforeShow, $elm);
                            }
                        });
                    }
                }
            }

            elmList.push({
                readOnly: readOnly,
                el: $elm,
                lbl: $label
            });
        }
    };

    /**
     * Set button handler.
     */
    that.select = function () {
        if (isModal) {
            that.hide(false, 'set', false, set);
        } else {
            set();
        }
    };

    /**
     * Cancel and hide the scroller instance.
     */
    that.cancel = function () {
        if (isModal) {
            that.hide(false, 'cancel', false, cancel);
        } else {
            cancel();
        }
    };

    /**
     * Clear button handler.
     */
    that.clear = function () {
        that._clearValue();
        trigger('onClear');
        if (isModal && that._isVisible && !that.live) {
            that.hide(false, 'clear', false, clear);
        } else {
            clear();
        }
    };

    /**
     * Enables the scroller and the associated input.
     */
    that.enable = function () {
        s.disabled = false;
        $.each(elmList, function (i, v) {
            if (v.el.is('input,select')) {
                v.el[0].disabled = false;
            }
        });
    };

    /**
     * Disables the scroller and the associated input.
     */
    that.disable = function () {
        s.disabled = true;
        $.each(elmList, function (i, v) {
            if (v.el.is('input,select')) {
                v.el[0].disabled = true;
            }
        });
    };

    /**
     * Shows the scroller instance.
     * @param {Boolean} prevAnim - Prevent animation if true
     * @param {Boolean} prevFocus - Prevent focusing if true
     */
    that.show = function (prevAnim, prevFocus) {
        var hasButtons,
            html,
            scrollLeft,
            scrollTop;

        if (s.disabled || that._isVisible) {
            return;
        }

        // Parse value from input
        that._readValue();

        if (trigger('onBeforeShow') === false) {
            return false;
        }

        $activeElm = null;

        doAnim = s.animate;
        buttons = s.buttons || [];

        needsDimensions = hasContext || s.display == 'bubble';
        needsLock = needsFixed && !needsDimensions && s.scrollLock;

        hasButtons = buttons.length > 0;

        //touched = false;

        if (doAnim !== false) {
            if (s.display == 'top') {
                doAnim = doAnim || 'slidedown';
            } else if (s.display == 'bottom') {
                doAnim = doAnim || 'slideup';
            } else if (s.display == 'center' || s.display == 'bubble') {
                doAnim = doAnim || 'pop';
            }
        }

        if (isModal) {
            wndWidth = 0;
            wndHeight = 0;

            if (needsLock && !$lock.hasClass('mbsc-fr-lock-ios')) {
                //$lock.scrollTop(0);
                ctx.mbscScrollTop = scrollTop = Math.max(0, $wnd.scrollTop());
                ctx.mbscScrollLeft = scrollLeft = Math.max(0, $wnd.scrollLeft());
                $ctx.css({
                    top: -scrollTop + 'px',
                    left: -scrollLeft + 'px'
                });
            }

            $lock.addClass((s.scrollLock ? 'mbsc-fr-lock' : '') + (needsLock ? ' mbsc-fr-lock-ios' : '') + (hasContext ? ' mbsc-fr-lock-ctx' : ''));

            // Hide virtual keyboard
            if ($(document.activeElement).is('input,textarea')) {
                document.activeElement.blur();
            }

            // Save active instance to previous
            prevInst = mobiscroll.activeInstance;

            // Set active instance
            mobiscroll.activeInstance = that;

            // Keep track of modals opened per context
            ctx.mbscModals = (ctx.mbscModals || 0) + 1;
            if (needsLock) {
                ctx.mbscIOSLock = (ctx.mbscIOSLock || 0) + 1;
            }
            if (s.scrollLock) {
                ctx.mbscLock = (ctx.mbscLock || 0) + 1;
            }
        }

        // Create wheels containers
        html = '<div lang="' + s.lang + '" class="mbsc-fr mbsc-' + s.theme +
            (s.baseTheme ? ' mbsc-' + s.baseTheme : '') + ' mbsc-fr-' + s.display + ' ' +
            (s.cssClass || '') + ' ' +
            (s.compClass || '') +
            (that._isLiquid ? ' mbsc-fr-liq' : '') +
            (isModal ? ' mbsc-fr-pos' + ((s.showOverlay ? '' : ' mbsc-fr-no-overlay')) : '') +
            (isPointer ? ' mbsc-fr-pointer' : '') +
            (halfBorder ? ' mbsc-fr-hb' : '') +
            (touched ? '' : ' mbsc-no-touch') +
            (needsLock ? ' mbsc-platform-ios' : '') +
            (hasButtons ? (buttons.length >= 3 ? ' mbsc-fr-btn-block ' : '') : ' mbsc-fr-nobtn') + '">' +
            (isModal ? '<div class="mbsc-fr-persp">' +
                (s.showOverlay ? '<div class="mbsc-fr-overlay"></div>' : '') + // Overlay
                '<div role="dialog" class="mbsc-fr-scroll">' : '') +
            '<div class="mbsc-fr-popup' +
            (s.rtl ? ' mbsc-rtl' : ' mbsc-ltr') +
            (s.headerText ? ' mbsc-fr-has-hdr' : '') +
            '">' + // Popup
            (s.display === 'bubble' ? '<div class="mbsc-fr-arr-w"><div class="mbsc-fr-arr-i"><div class="mbsc-fr-arr"></div></div></div>' : '') + // Bubble arrow
            (isModal ? '<div class="mbsc-fr-focus" tabindex="-1"></div>' : '') +
            '<div class="mbsc-fr-w">' + // Popup content
            //'<div aria-live="assertive" class="mbsc-fr-aria mbsc-fr-hdn"></div>' +
            (s.headerText ? '<div class="mbsc-fr-hdr">' + (isString(s.headerText) ? s.headerText : '') + '</div>' : '') + // Header
            '<div class="mbsc-fr-c">'; // Wheel group container

        html += that._generateContent();

        html += '</div>';

        if (hasButtons) {
            var b,
                i,
                j,
                l = buttons.length;

            html += '<div class="mbsc-fr-btn-cont">';
            for (i = 0; i < buttons.length; i++) {
                j = s.btnReverse ? l - i - 1 : i;
                b = buttons[j];
                b = isString(b) ? that.buttons[b] : b;

                if (b.handler === 'set') {
                    b.parentClass = 'mbsc-fr-btn-s';
                }

                if (b.handler === 'cancel') {
                    b.parentClass = 'mbsc-fr-btn-c';
                }

                html += '<div' + (s.btnWidth ? ' style="width:' + (100 / buttons.length) + '%"' : '') +
                    ' class="mbsc-fr-btn-w ' + (b.parentClass || '') + '">' +
                    '<div tabindex="0" role="button" class="mbsc-fr-btn' + j + ' mbsc-fr-btn-e ' +
                    (b.cssClass === undefined ? s.btnClass : b.cssClass) +
                    (b.icon ? ' mbsc-ic mbsc-ic-' + b.icon : '') + '">' + (b.text || '') + '</div></div>';
            }
            html += '</div>';
        }
        html += '</div></div></div></div>' + (isModal ? '</div></div>' : '');

        $markup = $(html);
        $persp = $('.mbsc-fr-persp', $markup);
        $overlay = $('.mbsc-fr-scroll', $markup);
        $wrapper = $('.mbsc-fr-w', $markup);
        $popup = $('.mbsc-fr-popup', $markup);
        $header = $('.mbsc-fr-hdr', $markup);
        //$ariaDiv = $('.mbsc-fr-aria', $markup);

        markup = $markup[0];
        overlay = $overlay[0];
        popup = $popup[0];

        that._activeElm = $('.mbsc-fr-focus', $markup)[0];
        that._markup = $markup;
        that._isVisible = true;
        that.markup = markup;

        that._markupReady($markup);

        trigger('onMarkupReady', {
            target: markup
        });

        // Attach events
        if (isModal) {
            // Enter / ESC
            $(window).on('keydown', onWndKeyDown);

            // Prevent scroll if not specified otherwise
            if (s.scrollLock) {
                listen(document, 'touchmove', onScroll, { passive: false });
                listen(document, 'mousewheel', onScroll, { passive: false });
                listen(document, 'wheel', onScroll, { passive: false });
            }

            if (s.focusTrap) {
                $wnd.on('focusin', onFocus);
            }
        }

        if (isModal) {
            // Wait for the toolbar and addressbar to appear on iOS
            setTimeout(function () {
                insertMarkup(prevAnim, prevFocus);
            }, needsLock ? 100 : 0);
        } else {
            insertMarkup(prevAnim, prevFocus);
        }
    };

    /**
     * Hides the scroller instance.
     */
    that.hide = function (prevAnim, btn, force, callback) {

        function onAnimEnd() {
            $markup.off(animEnd, onAnimEnd);
            onHide(prevAnim);
        }

        // If onClose handler returns false, prevent hide
        if (!that._isVisible || (!force && !that._isValid && btn == 'set') || (!force && trigger('onBeforeClose', {
                valueText: that._tempValue,
                button: btn
            }) === false)) {
            return false;
        }

        that._isVisible = false;

        if (observer) {
            observer.detach();
            observer = null;
        }

        if (isModal) {
            if ($(document.activeElement).is('input,textarea') && popup.contains(document.activeElement)) {
                document.activeElement.blur();
            }
            if (mobiscroll.activeInstance == that) {
                mobiscroll.activeInstance = prevInst;
            }
            $(window).off('keydown', onWndKeyDown);
            $wnd.off('focusin', onFocus);
            unlisten(document, 'touchmove', onScroll, { passive: false });
            unlisten(document, 'mousewheel', onScroll, { passive: false });
            unlisten(document, 'wheel', onScroll, { passive: false });
        }

        // Hide wheels and overlay
        if ($markup) {
            if (isModal && isInserted && doAnim && !prevAnim) {
                $markup
                    .addClass('mbsc-anim-out mbsc-anim-trans mbsc-anim-trans-' + doAnim)
                    .on(animEnd, onAnimEnd)
                    .find('.mbsc-fr-popup')
                    .addClass('mbsc-anim-' + doAnim);
            } else {
                onHide(prevAnim);
            }

            that._detachEvents($markup);
        }

        if (callback) {
            callback();
        }

        // For validation
        $elm.trigger('blur');

        trigger('onClose', {
            valueText: that._value
        });
    };

    // that.ariaMessage = function (txt) {
    //     $ariaDiv.html('');
    //     setTimeout(function () {
    //         $ariaDiv.html(txt);
    //     }, 100);
    // };

    /**
     * Return true if the scroller is currently visible.
     */
    that.isVisible = function () {
        return that._isVisible;
    };

    // Protected functions to override

    that.setVal = noop;

    that.getVal = noop;

    that._generateContent = noop;

    that._attachEvents = noop;

    that._detachEvents = noop;

    that._readValue = noop;

    that._clearValue = noop;

    that._fillValue = noop;

    that._markupReady = noop;

    that._markupInserted = noop;

    that._markupRemove = noop;

    that._position = noop;

    that.__processSettings = noop;

    that.__init = noop;

    that.__destroy = noop;

    // Generic frame functions

    /**
     * Destroys the mobiscroll instance.
     */
    that._destroy = function () {
        // Force hide without animation
        that.hide(true, false, true);

        $elm.off('.mbsc');

        tapOff($elm);

        // Remove all events from elements
        $.each(elmList, function (i, v) {
            v.el.off('.mbsc').prop('readonly', v.readOnly);
            tapOff(v.el);
            if (v.lbl) {
                v.lbl.off('.mbsc');
                tapOff(v.lbl);
            }
        });

        that.__destroy();
    };

    that._updateHeader = function () {
        var t = s.headerText,
            txt = t ? (typeof t === 'function' ? t.call(el, that._tempValue) : t.replace(/\{value\}/i, that._tempValue)) : '';
        $header.html(txt || '&nbsp;');
    };

    that._getRespCont = function () {
        hasContext = s.context != 'body';
        $wnd = $(hasContext ? s.context : window);
        return s.display == 'inline' ? ($elm.is('div') ? $elm : $elm.parent()) : $wnd;
    };

    that._processSettings = function (resp) {
        var b, i;

        that.__processSettings(resp);

        isPointer = !s.touchUi;

        if (isPointer) {
            s.display = resp.display || settings.display || 'bubble';
            s.buttons = resp.buttons || settings.buttons || [];
            s.showOverlay = resp.showOverlay || settings.showOverlay || false;
        }

        // Add default buttons
        s.buttons = s.buttons || (s.display !== 'inline' ? ['cancel', 'set'] : []);

        // Hide header text in inline mode by default
        s.headerText = s.headerText === undefined ? (s.display !== 'inline' ? '{value}' : false) : s.headerText;

        buttons = s.buttons || [];
        isModal = s.display !== 'inline';
        $ctx = $(s.context);
        $lock = hasContext ? $ctx : $('body,html');
        ctx = $ctx[0];

        that.live = true;

        // If no set button is found, live mode is activated
        for (i = 0; i < buttons.length; i++) {
            b = buttons[i];
            if (b == 'ok' || b == 'set' || b.handler == 'set') {
                that.live = false;
            }
        }

        that.buttons.set = {
            text: s.setText,
            icon: s.setIcon,
            handler: 'set'
        };

        that.buttons.cancel = {
            text: s.cancelText,
            icon: s.cancelIcon,
            handler: 'cancel'
        };

        that.buttons.close = {
            text: s.closeText,
            icon: s.closeIcon,
            handler: 'cancel'
        };

        that.buttons.clear = {
            text: s.clearText,
            icon: s.clearIcon,
            handler: 'clear'
        };

        that._isInput = $elm.is('input');
    };

    /**
     * Scroller initialization.
     */
    that._init = function (newSettings) {
        var wasVisible = that._isVisible,
            wasReady = wasVisible && !$markup.hasClass('mbsc-fr-pos');

        if (wasVisible) {
            that.hide(true, false, true);
        }

        // Unbind all events (if re-init)
        $elm.off('.mbsc');
        tapOff($elm);

        that.__init(newSettings);

        that._isLiquid = s.layout == 'liquid';

        if (isModal) {
            that._readValue();
            if (!that._hasContent && !s.skipShow) {
                that.attachShow($elm);
            }
            if (wasVisible) {
                that.show(wasReady);
            }
        } else {
            that.show();
        }

        $elm.removeClass('mbsc-cloak')
            .filter('input, select, textarea')
            .on('change.mbsc', function () {
                if (!that._preventChange) {
                    that.setVal($elm.val(), true, false);
                }
                that._preventChange = false;
            });
    };

    that.buttons = {};
    that.handlers = {
        set: that.select,
        cancel: that.cancel,
        clear: that.clear
    };

    that._value = null;

    that._isValid = true;
    that._isVisible = false;

    // Constructor

    s = that.settings;
    trigger = that.trigger;

    if (!inherit) {
        that.init();
    }
};

Frame.prototype._defaults = {
    // Localization
    lang: 'en',
    setText: 'Set',
    selectedText: '{count} selected',
    closeText: 'Close',
    cancelText: 'Cancel',
    clearText: 'Clear',
    // Options
    context: 'body',
    maxPopupWidth: 600,
    disabled: false,
    closeOnOverlayTap: true,
    showOnFocus: isAndroid || isIOS, // Needed for ion-input
    showOnTap: true,
    display: 'center',
    scroll: true,
    scrollLock: true,
    showOverlay: true,
    tap: true,
    touchUi: true,
    btnClass: 'mbsc-fr-btn',
    btnWidth: true,
    focusTrap: true,
    focusOnClose: !isIOS8 // Temporary for iOS8
};

classes.Frame = Frame;

themes.frame.mobiscroll = {
    headerText: false,
    btnWidth: false
};

themes.scroller.mobiscroll = extend({}, themes.frame.mobiscroll, {
    rows: 5,
    showLabel: false,
    selectedLineBorder: 1,
    weekDays: 'min',
    checkIcon: 'ion-ios7-checkmark-empty',
    btnPlusClass: 'mbsc-ic mbsc-ic-arrow-down5',
    btnMinusClass: 'mbsc-ic mbsc-ic-arrow-up5',
    btnCalPrevClass: 'mbsc-ic mbsc-ic-arrow-left5',
    btnCalNextClass: 'mbsc-ic mbsc-ic-arrow-right5'
});

if (isBrowser) {
    // Prevent re-show on window focus
    $(window).on('focus', function () {
        if ($activeElm) {
            preventShow = true;
        }
    });
}
