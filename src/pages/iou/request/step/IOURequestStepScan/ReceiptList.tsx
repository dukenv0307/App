import React, {useState} from 'react';
import {FlatList, Image, View} from 'react-native';
import Icon from '@components/Icon';
import * as Expensicons from '@components/Icon/Expensicons';
import PressableWithFeedback from '@components/Pressable/PressableWithFeedback';
import useLocalize from '@hooks/useLocalize';
import useTheme from '@hooks/useTheme';
import useThemeStyles from '@hooks/useThemeStyles';
import CONST from '@src/CONST';
import type {Receipt} from '@src/types/onyx/Transaction';
import ReceiptViewModal from './ReceiptViewModal';

type ReceiptsListProps = {
    /** The list of receipts to render */
    receipts: Receipt[];

    /** Whether multi-capture mode is enabled */
    isMultiCapture: boolean;

    /** Callback when user wants to proceed with the receipts */
    onNext: () => void;

    /** Setter function for updating receipts */
    setReceipts: React.Dispatch<React.SetStateAction<Receipt[]>>;
};

function ReceiptsList({receipts, isMultiCapture, onNext, setReceipts}: ReceiptsListProps) {
    const theme = useTheme();
    const styles = useThemeStyles();
    const {translate} = useLocalize();
    const [selectedReceiptIndex, setSelectedReceiptIndex] = useState<number | null>(null);

    const handleDeleteReceipt = (index: number) => {
        setReceipts((prevReceipts) => {
            const newReceipts = [...prevReceipts];
            newReceipts.splice(index, 1);
            return newReceipts;
        });
    };

    if (!isMultiCapture) {
        return null;
    }

    const isDisabled = receipts.length === 0;

    const placeholders = Array.from({length: 10 - receipts.length}, () => ({placeholder: true}));

    const displayedReceipts: Array<Receipt & {placeholder?: boolean}> = [...receipts, ...placeholders];

    return (
        <>
            <View style={[styles.pv2, styles.ph3, styles.w100, {backgroundColor: theme.appBG}]}>
                <View style={[styles.flexRow]}>
                    <FlatList
                        horizontal
                        showsHorizontalScrollIndicator={false}
                        data={displayedReceipts}
                        style={[styles.flex1]}
                        renderItem={({item, index}) =>
                            item.placeholder ? (
                                <View style={[styles.border, styles.mr2, styles.br1, {width: 44, height: 52, backgroundColor: theme.cardBG}]} />
                            ) : (
                                <PressableWithFeedback
                                    role={CONST.ROLE.BUTTON}
                                    accessibilityLabel={translate('common.receipt')}
                                    onPress={() => setSelectedReceiptIndex(index)}
                                >
                                    <View
                                        key={item.source}
                                        style={[styles.highlightBG, styles.mr2, styles.br1, {width: 44, height: 52}]}
                                    >
                                        <Image
                                            source={{uri: item.source}}
                                            style={[styles.w100, styles.h100, styles.br1]}
                                            resizeMode="cover"
                                        />
                                    </View>
                                </PressableWithFeedback>
                            )
                        }
                        keyExtractor={(item, index) => (item.placeholder ? `placeholder-${index}` : item.source ?? `receipt-${index}`)}
                    />
                    <PressableWithFeedback
                        role={CONST.ROLE.BUTTON}
                        accessibilityLabel={translate('common.next')}
                        style={[
                            styles.borderRadiusNormal,
                            styles.justifyContentCenter,
                            styles.alignItemsCenter,
                            {width: 52, height: 52},
                            styles.buttonSuccess,
                            isDisabled ? styles.buttonOpacityDisabled : undefined,
                        ]}
                        disabled={isDisabled}
                        onPress={onNext}
                    >
                        <Icon
                            height={20}
                            width={20}
                            src={Expensicons.ArrowRight}
                            fill={theme.white}
                        />
                    </PressableWithFeedback>
                </View>
            </View>
            <ReceiptViewModal
                selectedReceiptIndex={selectedReceiptIndex}
                setSelectedReceiptIndex={setSelectedReceiptIndex}
                receipts={receipts}
                onDelete={handleDeleteReceipt}
            />
        </>
    );
}

ReceiptsList.displayName = 'ReceiptsList';
export default ReceiptsList;
