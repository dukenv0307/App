import React, {memo, useEffect, useRef} from 'react';
import type {LayoutChangeEvent} from 'react-native';
import GenericTooltip from '@components/Tooltip/GenericTooltip';
import type TooltipProps from '@components/Tooltip/types';
import getBounds from './getBounds';

/**
 * A component used to wrap an element intended for displaying a tooltip.
 * This tooltip would show immediately without user's interaction and hide after 5 seconds.
 */
function BaseEducationalTooltip({children, ...props}: TooltipProps) {
    const hideTooltipRef = useRef<() => void>();

    useEffect(
        () => () => {
            if (!hideTooltipRef.current) {
                return;
            }

            hideTooltipRef.current();
        },
        [],
    );

    const abc = useRef(null);

    return (
        <GenericTooltip
            shouldForceAnimate
            // eslint-disable-next-line react/jsx-props-no-spreading
            {...props}
        >
            {({showTooltip, hideTooltip, updateTargetBounds}) => {
                // eslint-disable-next-line react-compiler/react-compiler
                hideTooltipRef.current = hideTooltip;
                return React.cloneElement(children as React.ReactElement, {
                    onLayout: (e: LayoutChangeEvent) => {
                        // on native we can use e.target, but on web it's undefined so we need to use e.nativeEvent.target
                        const target = e.target || e.nativeEvent.target
                        target?.measure((fx, fy, width, height, px, py)=>{
                            updateTargetBounds({
                                height,
                                width,
                                x: px,
                                y:py
                            });
                        })
                        
                        showTooltip();
                    },
                    ref: abc
                });
            }}
        </GenericTooltip>
    );
}

BaseEducationalTooltip.displayName = 'BaseEducationalTooltip';

export default memo(BaseEducationalTooltip);
