import React from 'react';
import {useOnyx} from 'react-native-onyx';
import ConfirmModal from '@components/ConfirmModal';
import {MultiScanIntroduction} from '@components/Icon/Illustrations';
import Text from '@components/Text';
import useLocalize from '@hooks/useLocalize';
import useStyleUtils from '@hooks/useStyleUtils';
import useThemeStyles from '@hooks/useThemeStyles';
import {clearMultiScanNotification} from '@libs/actions/User';
import colors from '@styles/theme/colors';
import ONYXKEYS from '@src/ONYXKEYS';

function MultiScanNotification({isMultiCapture}: {isMultiCapture: boolean}) {
    const {translate} = useLocalize();
    const StyleUtils = useStyleUtils();
    const styles = useThemeStyles();
    const [tryMultiScan] = useOnyx(ONYXKEYS.NVP_TRY_MULTI_SCAN);

    return (
        <ConfirmModal
            title={translate('receipt.multiCaptureGuide')}
            confirmText={translate('common.buttonConfirm')}
            onConfirm={clearMultiScanNotification}
            shouldShowCancelButton={false}
            onBackdropPress={clearMultiScanNotification}
            onCancel={clearMultiScanNotification}
            prompt={<Text style={styles.textSupporting}>{translate('receipt.multiCaptureGuideDescription')}</Text>}
            isVisible={isMultiCapture && tryMultiScan !== true}
            image={MultiScanIntroduction}
            imageStyles={[StyleUtils.getBackgroundColorStyle(colors.pink700)]}
            titleStyles={[styles.textHeadline, styles.mbn3]}
        />
    );
}

MultiScanNotification.displayName = 'MultiScanNotification';
export default MultiScanNotification;
