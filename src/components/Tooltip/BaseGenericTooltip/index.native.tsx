import React, {useEffect, useMemo, useRef, useState} from 'react';
import {Animated, View} from 'react-native';
// eslint-disable-next-line no-restricted-imports
import type {Text as RNText, View as RNView} from 'react-native';
import Text from '@components/Text';
import useStyleUtils from '@hooks/useStyleUtils';
import CONST from '@src/CONST';
import type {BaseGenericTooltipProps} from './types';
import { Portal } from '@gorhom/portal';
import TransparentOverlay from '@components/AutoCompleteSuggestions/AutoCompleteSuggestionsPortal/TransparentOverlay/TransparentOverlay';
import { GUTTER_WIDTH } from '@styles/utils/generators/TooltipStyleUtils/computeHorizontalShift';

// Props will change frequently.
// On every tooltip hover, we update the position in state which will result in re-rendering.
// We also update the state on layout changes which will be triggered often.
// There will be n number of tooltip components in the page.
// It's good to memoize this one.
function BaseGenericTooltip({
    animation,
    windowWidth,
    xOffset,
    yOffset,
    targetWidth,
    targetHeight,
    shiftHorizontal = 0,
    shiftVertical = 0,
    text,
    numberOfLines,
    maxWidth = 0,
    renderTooltipContent,
    shouldForceRenderingBelow = false,
    anchorAlignment = {
        horizontal: CONST.MODAL.ANCHOR_ORIGIN_HORIZONTAL.CENTER,
        vertical: CONST.MODAL.ANCHOR_ORIGIN_VERTICAL.BOTTOM,
    },
    wrapperStyle = {},
    hideTooltip,
    isVisible
}: BaseGenericTooltipProps) {
    // The width of tooltip's inner content. Has to be undefined in the beginning
    // as a width of 0 will cause the content to be rendered of a width of 0,
    // which prevents us from measuring it correctly.
    const [contentMeasuredWidth, setContentMeasuredWidth] = useState<number>();

    // The height of tooltip's wrapper.
    const [wrapperMeasuredHeight, setWrapperMeasuredHeight] = useState<number>();
    const rootWrapper = useRef<RNView>(null);

    const StyleUtils = useStyleUtils();

    const {animationStyle, rootWrapperStyle, textStyle, pointerWrapperStyle, pointerStyle} = useMemo(
        () =>
            StyleUtils.getTooltipStyles({
                tooltip: rootWrapper.current,
                currentSize: animation,
                windowWidth,
                xOffset:xOffset-windowWidth,
                // on native we need the yOffset is calculated from bottom edge of element to the top of screen so we need
                // to minus targetHeight and GUTTER_WIDTH to be consistent with other platform
                yOffset: yOffset-targetHeight - GUTTER_WIDTH,
                tooltipTargetWidth: targetWidth,
                tooltipTargetHeight: targetHeight,
                maxWidth,
                tooltipContentWidth: contentMeasuredWidth,
                tooltipWrapperHeight: wrapperMeasuredHeight,
                manualShiftHorizontal: shiftHorizontal,
                manualShiftVertical: shiftVertical,
                shouldForceRenderingBelow,
                anchorAlignment,
                wrapperStyle,
            }),
        [
            StyleUtils,
            animation,
            windowWidth,
            xOffset,
            yOffset,
            targetWidth,
            targetHeight,
            maxWidth,
            contentMeasuredWidth,
            wrapperMeasuredHeight,
            shiftHorizontal,
            shiftVertical,
            shouldForceRenderingBelow,
            anchorAlignment,
            wrapperStyle,
        ],
    );

    let content;
    if (renderTooltipContent) {
        content = <View>{renderTooltipContent()}</View>;
    } else {
        content = (
            <Text
                numberOfLines={numberOfLines}
                style={textStyle}
            >
                <Text
                    style={textStyle}
                >
                    {text}
                </Text>
            </Text>
        );
    }


    if(!isVisible){
        return null
    };

    return  <Portal hostName="suggestions">
    <TransparentOverlay resetSuggestions={hideTooltip} />
    <Animated.View
            ref={rootWrapper}
            style={[rootWrapperStyle, animationStyle]}
            onLayout={(e) => {
                const {height} = e.nativeEvent.layout;
                if (height === wrapperMeasuredHeight) {
                    return;
                }
                setWrapperMeasuredHeight(height);
                e.target.measure((x, y, width) => {
                    setContentMeasuredWidth(width)
                })
            }}
        >
            {content}
            <View style={pointerWrapperStyle}>
                <View style={pointerStyle} />
            </View>
        </Animated.View>
</Portal>
}

BaseGenericTooltip.displayName = 'BaseGenericTooltip';

export default React.memo(BaseGenericTooltip);
