import type {MutableRefObject} from 'react';
import React, {useCallback, useEffect, useMemo, useRef, useState} from 'react';
import type {ListRenderItemInfo} from 'react-native';
import {Keyboard, PixelRatio, View} from 'react-native';
import type {ComposedGesture, GestureType} from 'react-native-gesture-handler';
import {Gesture, GestureDetector} from 'react-native-gesture-handler';
import Animated, {scrollTo, useAnimatedRef, useSharedValue} from 'react-native-reanimated';
import CarouselActions from '@components/Attachments/AttachmentCarousel/CarouselActions';
import CarouselButtons from '@components/Attachments/AttachmentCarousel/CarouselButtons';
import CarouselItem from '@components/Attachments/AttachmentCarousel/CarouselItem';
import AttachmentCarouselPagerContext from '@components/Attachments/AttachmentCarousel/Pager/AttachmentCarouselPagerContext';
import type {AttachmentCarouselViewProps, UpdatePageProps} from '@components/Attachments/AttachmentCarousel/types';
import useCarouselArrows from '@components/Attachments/AttachmentCarousel/useCarouselArrows';
import useCarouselContextEvents from '@components/Attachments/AttachmentCarousel/useCarouselContextEvents';
import type {Attachment, AttachmentSource} from '@components/Attachments/types';
import BlockingView from '@components/BlockingViews/BlockingView';
import {ToddBehindCloud} from '@components/Icon/Illustrations';
import {useFullScreenContext} from '@components/VideoPlayerContexts/FullScreenContext';
import useLocalize from '@hooks/useLocalize';
import useResponsiveLayout from '@hooks/useResponsiveLayout';
import useTheme from '@hooks/useTheme';
import useThemeStyles from '@hooks/useThemeStyles';
import useWindowDimensions from '@hooks/useWindowDimensions';
import {canUseTouchScreen as canUseTouchScreenUtil} from '@libs/DeviceCapabilities';
import variables from '@styles/variables';
import CONST from '@src/CONST';

const viewabilityConfig = {
    // To facilitate paging through the attachments, we want to consider an item "viewable" when it is
    // more than 95% visible. When that happens we update the page index in the state.
    itemVisiblePercentThreshold: 95,
};

const MIN_FLING_VELOCITY = 500;

type DeviceAwareGestureDetectorProps = {
    canUseTouchScreen: boolean;
    gesture: ComposedGesture | GestureType;
    children: React.ReactNode;
};

function DeviceAwareGestureDetector({canUseTouchScreen, gesture, children}: DeviceAwareGestureDetectorProps) {
    // Don't render GestureDetector on non-touchable devices to prevent unexpected pointer event capture.
    // This issue is left out on touchable devices since finger touch works fine.
    // See: https://github.com/Expensify/App/issues/51246
    return canUseTouchScreen ? <GestureDetector gesture={gesture}>{children}</GestureDetector> : children;
}

function AttachmentCarouselView({attachmentID, reportID, source, onNavigate, onClose, attachments, page, setPage}: AttachmentCarouselViewProps) {
    const theme = useTheme();
    const {translate} = useLocalize();
    const {windowWidth} = useWindowDimensions();
    const {shouldUseNarrowLayout} = useResponsiveLayout();
    const styles = useThemeStyles();
    const {isFullScreenRef} = useFullScreenContext();
    const scrollRef = useAnimatedRef<Animated.FlatList<ListRenderItemInfo<Attachment>>>();
    const isPagerScrolling = useSharedValue(false);
    const pagerRef = useRef<GestureType>(null);

    const canUseTouchScreen = canUseTouchScreenUtil();

    const modalStyles = styles.centeredModalStyles(shouldUseNarrowLayout, true);
    const cellWidth = useMemo(
        () => PixelRatio.roundToNearestPixel(windowWidth - (modalStyles.marginHorizontal + modalStyles.borderWidth) * 2),
        [modalStyles.borderWidth, modalStyles.marginHorizontal, windowWidth],
    );
    const [activeAttachmentID, setActiveAttachmentID] = useState<AttachmentSource | null>(attachmentID ?? source);

    const {shouldShowArrows, setShouldShowArrows, autoHideArrows, cancelAutoHideArrows} = useCarouselArrows();
    const {handleTap, handleScaleChange, isScrollEnabled} = useCarouselContextEvents(setShouldShowArrows);

    useEffect(() => {
        if (!canUseTouchScreen) {
            return;
        }
        setShouldShowArrows(true);
    }, [canUseTouchScreen, page, setShouldShowArrows]);

    // Scroll position is affected when window width is resized, so we readjust it on width changes
    useEffect(() => {
        if (attachments.length === 0 || scrollRef.current == null) {
            return;
        }

        scrollRef.current.scrollToIndex({index: page, animated: false});
        // The hook is not supposed to run on page change, so we keep the page out of the dependencies
        // eslint-disable-next-line react-compiler/react-compiler, react-hooks/exhaustive-deps
    }, [cellWidth]);

    /** Updates the page state when the user navigates between attachments */
    const updatePage = useCallback(
        ({viewableItems}: UpdatePageProps) => {
            if (isFullScreenRef.current) {
                return;
            }

            Keyboard.dismiss();

            // Since we can have only one item in view at a time, we can use the first item in the array
            // to get the index of the current page
            const entry = viewableItems.at(0);
            if (!entry) {
                setActiveAttachmentID(null);
                return;
            }

            const item = entry.item as Attachment;
            if (entry.index !== null) {
                setPage(entry.index);
                setActiveAttachmentID(item.attachmentID ?? item.source);
            }

            if (onNavigate) {
                onNavigate(item);
            }
        },
        [isFullScreenRef, onNavigate, setPage],
    );

    /** Increments or decrements the index to get another selected item */
    const cycleThroughAttachments = useCallback(
        (deltaSlide: number) => {
            if (isFullScreenRef.current) {
                return;
            }

            const nextIndex = page + deltaSlide;
            const nextItem = attachments.at(nextIndex);

            if (!nextItem || nextIndex < 0 || !scrollRef.current) {
                return;
            }

            scrollRef.current.scrollToIndex({index: nextIndex, animated: canUseTouchScreen});
        },
        [attachments, canUseTouchScreen, isFullScreenRef, page, scrollRef],
    );

    const extractItemKey = useCallback(
        (item: Attachment) =>
            !!item.attachmentID || (typeof item.source !== 'string' && typeof item.source !== 'number')
                ? `attachmentID-${item.attachmentID}`
                : `source-${item.source}|${item.attachmentLink}`,
        [],
    );

    /** Calculate items layout information to optimize scrolling performance */
    const getItemLayout = useCallback(
        (data: ArrayLike<Attachment> | null | undefined, index: number) => ({
            length: cellWidth,
            offset: cellWidth * index,
            index,
        }),
        [cellWidth],
    );

    const context = useMemo(
        () => ({
            pagerItems: [{source, index: 0, isActive: true}],
            activePage: 0,
            pagerRef,
            isPagerScrolling,
            isScrollEnabled,
            onTap: handleTap,
            onScaleChanged: handleScaleChange,
            onSwipeDown: onClose,
        }),
        [source, isPagerScrolling, isScrollEnabled, handleTap, handleScaleChange, onClose],
    );

    /** Defines how a single attachment should be rendered */
    const renderItem = useCallback(
        ({item}: ListRenderItemInfo<Attachment>) => (
            <View style={[styles.h100, {width: cellWidth}]}>
                <CarouselItem
                    item={item}
                    isFocused={activeAttachmentID === (item.attachmentID ?? item.source)}
                    onPress={canUseTouchScreen ? handleTap : undefined}
                    isModalHovered={shouldShowArrows}
                    reportID={reportID}
                />
            </View>
        ),
        [activeAttachmentID, canUseTouchScreen, cellWidth, handleTap, reportID, shouldShowArrows, styles.h100],
    );
    /** Pan gesture handing swiping through attachments on touch screen devices */
    const pan = useMemo(
        () =>
            Gesture.Pan()
                .enabled(canUseTouchScreen)
                .onUpdate(({translationX}) => {
                    if (!isScrollEnabled.get()) {
                        return;
                    }

                    if (translationX !== 0) {
                        isPagerScrolling.set(true);
                    }

                    scrollTo(scrollRef, page * cellWidth - translationX, 0, false);
                })
                .onEnd(({translationX, velocityX}) => {
                    if (!isScrollEnabled.get()) {
                        return;
                    }

                    let newIndex;
                    if (velocityX > MIN_FLING_VELOCITY) {
                        // User flung to the right
                        newIndex = Math.max(0, page - 1);
                    } else if (velocityX < -MIN_FLING_VELOCITY) {
                        // User flung to the left
                        newIndex = Math.min(attachments.length - 1, page + 1);
                    } else {
                        // snap scroll position to the nearest cell (making sure it's within the bounds of the list)
                        const delta = Math.round(-translationX / cellWidth);
                        newIndex = Math.min(attachments.length - 1, Math.max(0, page + delta));
                    }

                    isPagerScrolling.set(false);
                    scrollTo(scrollRef, newIndex * cellWidth, 0, true);
                })
                // eslint-disable-next-line react-compiler/react-compiler
                .withRef(pagerRef as MutableRefObject<GestureType | undefined>),
        [attachments.length, canUseTouchScreen, cellWidth, page, isScrollEnabled, scrollRef, isPagerScrolling],
    );

    return (
        <View
            style={[styles.flex1, styles.attachmentCarouselContainer]}
            onMouseEnter={() => !canUseTouchScreen && setShouldShowArrows(true)}
            onMouseLeave={() => !canUseTouchScreen && setShouldShowArrows(false)}
        >
            {page === -1 ? (
                <BlockingView
                    icon={ToddBehindCloud}
                    iconColor={theme.offline}
                    iconWidth={variables.modalTopIconWidth}
                    iconHeight={variables.modalTopIconHeight}
                    title={translate('notFound.notHere')}
                />
            ) : (
                <>
                    <CarouselButtons
                        shouldShowArrows={shouldShowArrows}
                        page={page}
                        attachments={attachments}
                        onBack={() => cycleThroughAttachments(-1)}
                        onForward={() => cycleThroughAttachments(1)}
                        autoHideArrow={autoHideArrows}
                        cancelAutoHideArrow={cancelAutoHideArrows}
                    />
                    <AttachmentCarouselPagerContext.Provider value={context}>
                        <DeviceAwareGestureDetector
                            canUseTouchScreen={canUseTouchScreen}
                            gesture={pan}
                        >
                            <Animated.FlatList
                                keyboardShouldPersistTaps="handled"
                                horizontal
                                showsHorizontalScrollIndicator={false}
                                // scrolling is controlled by the pan gesture
                                scrollEnabled={false}
                                ref={scrollRef}
                                initialScrollIndex={page}
                                initialNumToRender={3}
                                windowSize={5}
                                maxToRenderPerBatch={CONST.MAX_TO_RENDER_PER_BATCH.CAROUSEL}
                                data={attachments}
                                renderItem={renderItem}
                                getItemLayout={getItemLayout}
                                keyExtractor={extractItemKey}
                                viewabilityConfig={viewabilityConfig}
                                onViewableItemsChanged={updatePage}
                            />
                        </DeviceAwareGestureDetector>
                    </AttachmentCarouselPagerContext.Provider>

                    <CarouselActions onCycleThroughAttachments={cycleThroughAttachments} />
                </>
            )}
        </View>
    );
}

AttachmentCarouselView.displayName = 'AttachmentCarouselView';

export default AttachmentCarouselView;
