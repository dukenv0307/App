import React, {useMemo} from 'react';
import AttachmentCarouselView from '@components/Attachments/AttachmentCarousel/AttachmentCarouselView';
import type {Attachment} from '@components/Attachments/types';
import HeaderWithBackButton from '@components/HeaderWithBackButton';
import * as Expensicons from '@components/Icon/Expensicons';
import Modal from '@components/Modal';
import useLocalize from '@hooks/useLocalize';
import CONST from '@src/CONST';
import type {Receipt} from '@src/types/onyx/Transaction';

type ReceiptViewModalProps = {
    selectedReceiptIndex: number | null;
    setSelectedReceiptIndex: (index: number | null) => void;
    receipts: Receipt[];
    onDelete: (index: number) => void;
};

function ReceiptViewModal({selectedReceiptIndex, setSelectedReceiptIndex, receipts, onDelete}: ReceiptViewModalProps) {
    const {translate} = useLocalize();

    const attachments: Attachment[] = useMemo(() => {
        return receipts.map((receipt) => ({
            ...receipt,
            source: receipt.source ?? '',
            file: {
                name: receipt.name ?? '',
            },
        }));
    }, [receipts]);

    const source = selectedReceiptIndex !== null && attachments.at(selectedReceiptIndex)?.source;

    return (
        <Modal
            isVisible={selectedReceiptIndex !== null}
            onClose={() => setSelectedReceiptIndex(null)}
            type={CONST.MODAL.MODAL_TYPE.CENTERED}
        >
            <HeaderWithBackButton
                title={translate('common.receipt')}
                onBackButtonPress={() => setSelectedReceiptIndex(null)}
                rightIcon={Expensicons.Trashcan}
                onRightIconPress={() => {
                    if (selectedReceiptIndex === null) {
                        return;
                    }
                    if (receipts.length === 1) {
                        setSelectedReceiptIndex(null);
                    }
                    onDelete(selectedReceiptIndex);
                }}
                shouldShowBorderBottom
            />
            {!!source && (
                <AttachmentCarouselView
                    attachments={attachments}
                    source={source}
                    onClose={() => setSelectedReceiptIndex(null)}
                    page={selectedReceiptIndex}
                    setPage={setSelectedReceiptIndex}
                />
            )}
        </Modal>
    );
}

export default ReceiptViewModal;
