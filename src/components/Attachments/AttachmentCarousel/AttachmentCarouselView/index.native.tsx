import React, {useCallback, useRef, useState} from 'react';
import {Keyboard, View} from 'react-native';
import CarouselButtons from '@components/Attachments/AttachmentCarousel/CarouselButtons';
import type {AttachmentCarouselPagerHandle} from '@components/Attachments/AttachmentCarousel/Pager';
import AttachmentCarouselPager from '@components/Attachments/AttachmentCarousel/Pager';
import type {AttachmentCarouselViewProps} from '@components/Attachments/AttachmentCarousel/types';
import useCarouselArrows from '@components/Attachments/AttachmentCarousel/useCarouselArrows';
import type {AttachmentSource} from '@components/Attachments/types';
import BlockingView from '@components/BlockingViews/BlockingView';
import FullScreenLoadingIndicator from '@components/FullscreenLoadingIndicator';
import {ToddBehindCloud} from '@components/Icon/Illustrations';
import useLocalize from '@hooks/useLocalize';
import useThemeStyles from '@hooks/useThemeStyles';
import variables from '@styles/variables';

function AttachmentCarouselView({attachmentID, reportID, source, onNavigate, onClose, attachments, page, setPage}: AttachmentCarouselViewProps) {
    const styles = useThemeStyles();
    const {translate} = useLocalize();
    const pagerRef = useRef<AttachmentCarouselPagerHandle>(null);
    const {shouldShowArrows, setShouldShowArrows, autoHideArrows, cancelAutoHideArrows} = useCarouselArrows();

    const [activeAttachmentID, setActiveAttachmentID] = useState<AttachmentSource>(attachmentID ?? source);

    /** Updates the page state when the user navigates between attachments */
    const updatePage = useCallback(
        (newPageIndex: number) => {
            Keyboard.dismiss();
            setShouldShowArrows(true);
            const item = attachments.at(newPageIndex);

            setPage(newPageIndex);
            if (newPageIndex >= 0 && item) {
                setActiveAttachmentID(item.attachmentID ?? item.source);
                if (onNavigate) {
                    onNavigate(item);
                }
                onNavigate?.(item);
            }
        },
        [setShouldShowArrows, attachments, onNavigate, setPage],
    );

    /**
     * Increments or decrements the index to get another selected item
     * @param {Number} deltaSlide
     */
    const cycleThroughAttachments = useCallback(
        (deltaSlide: number) => {
            if (page === undefined) {
                return;
            }
            const nextPageIndex = page + deltaSlide;
            updatePage(nextPageIndex);
            pagerRef.current?.setPage(nextPageIndex);

            autoHideArrows();
        },
        [autoHideArrows, page, updatePage],
    );

    const containerStyles = [styles.flex1, styles.attachmentCarouselContainer];

    if (page == null) {
        return (
            <View style={containerStyles}>
                <FullScreenLoadingIndicator />
            </View>
        );
    }

    return (
        <View style={containerStyles}>
            {page === -1 ? (
                <BlockingView
                    icon={ToddBehindCloud}
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

                    <AttachmentCarouselPager
                        items={attachments}
                        initialPage={page}
                        activeAttachmentID={activeAttachmentID}
                        setShouldShowArrows={setShouldShowArrows}
                        onPageSelected={({nativeEvent: {position: newPage}}) => updatePage(newPage)}
                        onClose={onClose}
                        ref={pagerRef}
                        reportID={reportID}
                    />
                </>
            )}
        </View>
    );
}

AttachmentCarouselView.displayName = 'AttachmentCarouselView';

export default AttachmentCarouselView;
