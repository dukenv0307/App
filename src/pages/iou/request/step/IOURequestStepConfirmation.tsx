import {Str} from 'expensify-common';
import React, {useCallback, useEffect, useMemo, useRef, useState} from 'react';
import {View} from 'react-native';
import type {OnyxEntry} from 'react-native-onyx';
import {useOnyx} from 'react-native-onyx';
import type {FileObject} from '@components/AttachmentModal';
import Button from '@components/Button';
import ConfirmModal from '@components/ConfirmModal';
import DragAndDropProvider from '@components/DragAndDrop/Provider';
import FullScreenLoadingIndicator from '@components/FullscreenLoadingIndicator';
import HeaderWithBackButton from '@components/HeaderWithBackButton';
import * as Expensicons from '@components/Icon/Expensicons';
import LocationPermissionModal from '@components/LocationPermissionModal';
import MoneyRequestConfirmationList from '@components/MoneyRequestConfirmationList';
import {usePersonalDetails} from '@components/OnyxProvider';
import PDFThumbnail from '@components/PDFThumbnail';
import {useProductTrainingContext} from '@components/ProductTrainingContext';
import ScreenWrapper from '@components/ScreenWrapper';
import EducationalTooltip from '@components/Tooltip/EducationalTooltip';
import useCurrentUserPersonalDetails from '@hooks/useCurrentUserPersonalDetails';
import useFetchRoute from '@hooks/useFetchRoute';
import useLocalize from '@hooks/useLocalize';
import useNetwork from '@hooks/useNetwork';
import useThemeStyles from '@hooks/useThemeStyles';
import useThreeDotsAnchorPosition from '@hooks/useThreeDotsAnchorPosition';
import {getPolicyCategoriesData} from '@libs/actions/Policy/Category';
import {getPolicyTagsData} from '@libs/actions/Policy/Tag';
import DateUtils from '@libs/DateUtils';
import {canUseTouchScreen} from '@libs/DeviceCapabilities';
import {isLocalFile as isLocalFileFileUtils, resizeImageIfNeeded, validateReceipt} from '@libs/fileDownload/FileUtils';
import getCurrentPosition from '@libs/getCurrentPosition';
import {isMovingTransactionFromTrackExpense as isMovingTransactionFromTrackExpenseIOUUtils, navigateToStartMoneyRequestStep, shouldUseTransactionDraft} from '@libs/IOUUtils';
import Log from '@libs/Log';
import navigateAfterInteraction from '@libs/Navigation/navigateAfterInteraction';
import Navigation from '@libs/Navigation/Navigation';
import {getParticipantsOption, getReportOption} from '@libs/OptionsListUtils';
import {getPolicy} from '@libs/PolicyUtils';
import {generateReportID, getBankAccountRoute, getReportOrDraftReport, isSelectedManagerMcTest} from '@libs/ReportUtils';
import playSound, {SOUNDS} from '@libs/Sound';
import {getDefaultTaxCode, getRateID, getRequestType, getValidWaypoints} from '@libs/TransactionUtils';
import ReceiptDropUI from '@pages/iou/ReceiptDropUI';
import type {GpsPoint} from '@userActions/IOU';
import {
    createDistanceRequest as createDistanceRequestIOUActions,
    getIOURequestPolicyID,
    navigateToStartStepIfScanFileCannotBeRead,
    requestMoney as requestMoneyIOUActions,
    sendInvoice,
    sendMoneyElsewhere,
    sendMoneyWithWallet,
    setMoneyRequestBillable,
    setMoneyRequestCategory,
    setMoneyRequestReceipt,
    splitBill,
    splitBillAndOpenReport,
    startMoneyRequest,
    startSplitBill,
    submitPerDiemExpense as submitPerDiemExpenseIOUActions,
    trackExpense as trackExpenseIOUActions,
    updateLastLocationPermissionPrompt,
} from '@userActions/IOU';
import {openDraftWorkspaceRequest} from '@userActions/Policy/Policy';
import CONST from '@src/CONST';
import type {TranslationPaths} from '@src/languages/types';
import ONYXKEYS from '@src/ONYXKEYS';
import ROUTES from '@src/ROUTES';
import type SCREENS from '@src/SCREENS';
import type {Policy, PolicyCategories, PolicyTagLists, Report} from '@src/types/onyx';
import type {Participant} from '@src/types/onyx/IOU';
import type {PaymentMethodType} from '@src/types/onyx/OriginalMessage';
import type {Receipt} from '@src/types/onyx/Transaction';
import type Transaction from '@src/types/onyx/Transaction';
import {isEmptyObject} from '@src/types/utils/EmptyObject';
import type {WithFullTransactionOrNotFoundProps} from './withFullTransactionOrNotFound';
import withFullTransactionOrNotFound from './withFullTransactionOrNotFound';
import type {WithWritableReportOrNotFoundProps} from './withWritableReportOrNotFound';
import withWritableReportOrNotFound from './withWritableReportOrNotFound';

type IOURequestStepConfirmationProps = WithWritableReportOrNotFoundProps<typeof SCREENS.MONEY_REQUEST.STEP_CONFIRMATION> &
    WithFullTransactionOrNotFoundProps<typeof SCREENS.MONEY_REQUEST.STEP_CONFIRMATION>;

type TaxParams = {
    taxCode: string;
    taxAmount: number;
};

function IOURequestStepConfirmation({
    report: reportReal,
    reportDraft,
    route: {
        params: {iouType, reportID, transactionID, action, participantsAutoAssigned: participantsAutoAssignedFromRoute, isMultiCapture, backTo},
    },
    transaction,
    isLoadingTransaction,
}: IOURequestStepConfirmationProps) {
    const currentUserPersonalDetails = useCurrentUserPersonalDetails();
    const personalDetails = usePersonalDetails();
    const [policyDraft] = useOnyx(`${ONYXKEYS.COLLECTION.POLICY_DRAFTS}${getIOURequestPolicyID(transaction, reportDraft)}`);
    const [policyReal] = useOnyx(`${ONYXKEYS.COLLECTION.POLICY}${getIOURequestPolicyID(transaction, reportReal)}`);
    const [policyCategoriesReal] = useOnyx(`${ONYXKEYS.COLLECTION.POLICY_CATEGORIES}${getIOURequestPolicyID(transaction, reportReal)}`);
    const [policyCategoriesDraft] = useOnyx(`${ONYXKEYS.COLLECTION.POLICY_CATEGORIES}${getIOURequestPolicyID(transaction, reportDraft)}`);
    const [policyTags] = useOnyx(`${ONYXKEYS.COLLECTION.POLICY_TAGS}${getIOURequestPolicyID(transaction, reportReal)}`);
    const [userLocation] = useOnyx(ONYXKEYS.USER_LOCATION);

    const report = reportReal ?? reportDraft;
    const policy = policyReal ?? policyDraft;
    const isDraftPolicy = policy === policyDraft;
    const policyCategories = policyCategoriesReal ?? policyCategoriesDraft;

    const styles = useThemeStyles();
    const {translate} = useLocalize();
    const threeDotsAnchorPosition = useThreeDotsAnchorPosition(styles.threeDotsPopoverOffsetNoCloseButton);
    const {isOffline} = useNetwork();
    const [startLocationPermissionFlow, setStartLocationPermissionFlow] = useState(false);
    const [selectedParticipantList, setSelectedParticipantList] = useState<Participant[]>([]);
    const [isDraggingOver, setIsDraggingOver] = useState(false);

    const [isAttachmentInvalid, setIsAttachmentInvalid] = useState(false);
    const [attachmentInvalidReasonTitle, setAttachmentInvalidReasonTitle] = useState<TranslationPaths>();
    const [attachmentInvalidReason, setAttachmentValidReason] = useState<TranslationPaths>();
    const [pdfFile, setPdfFile] = useState<null | FileObject>(null);
    const [isLoadingReceipt, setIsLoadingReceipt] = useState(false);

    const [receiptFiles, setReceiptFiles] = useState<Record<string, Receipt>>({});
    const requestType = getRequestType(transaction);
    const isDistanceRequest = requestType === CONST.IOU.REQUEST_TYPE.DISTANCE;
    const isPerDiemRequest = requestType === CONST.IOU.REQUEST_TYPE.PER_DIEM;
    const [lastLocationPermissionPrompt] = useOnyx(ONYXKEYS.NVP_LAST_LOCATION_PERMISSION_PROMPT);
    const [transactionDrafts] = useOnyx(ONYXKEYS.COLLECTION.TRANSACTION_DRAFT);

    const receiptFilename = transaction?.filename;
    const customUnitRateID = getRateID(transaction) ?? '';
    const defaultTaxCode = getDefaultTaxCode(policy, transaction);
    const transactionTaxCode = (transaction?.taxCode ? transaction?.taxCode : defaultTaxCode) ?? '';
    const transactionTaxAmount = transaction?.taxAmount ?? 0;
    const isSharingTrackExpense = action === CONST.IOU.ACTION.SHARE;
    const isCategorizingTrackExpense = action === CONST.IOU.ACTION.CATEGORIZE;
    const isMovingTransactionFromTrackExpense = isMovingTransactionFromTrackExpenseIOUUtils(action);
    const isTestTransaction = transaction?.participants?.some((participant) => isSelectedManagerMcTest(participant.login));
    const payeePersonalDetails = useMemo(() => {
        if (personalDetails?.[transaction?.splitPayerAccountIDs?.at(0) ?? -1]) {
            return personalDetails?.[transaction?.splitPayerAccountIDs?.at(0) ?? -1];
        }

        const participant = transaction?.participants?.find((val) => val.accountID === (transaction?.splitPayerAccountIDs?.at(0) ?? -1));

        return {
            login: participant?.login ?? '',
            accountID: participant?.accountID ?? CONST.DEFAULT_NUMBER_ID,
            avatar: Expensicons.FallbackAvatar,
            displayName: participant?.login ?? '',
            isOptimisticPersonalDetail: true,
        };
    }, [personalDetails, transaction?.participants, transaction?.splitPayerAccountIDs]);

    const gpsRequired = transaction?.amount === 0 && iouType !== CONST.IOU.TYPE.SPLIT && receiptFiles[transactionID] && !isTestTransaction;
    const [isConfirmed, setIsConfirmed] = useState(false);
    const [isConfirming, setIsConfirming] = useState(false);

    const {shouldShowProductTrainingTooltip, renderProductTrainingTooltip} = useProductTrainingContext(CONST.PRODUCT_TRAINING_TOOLTIP_NAMES.MULTI_SCAN_TOOLTIP, isMultiCapture);

    const totalTransactions = Object.keys(transactionDrafts ?? {}).length;

    const headerTitle = useMemo(() => {
        if (isCategorizingTrackExpense) {
            return translate('iou.categorize');
        }
        if (isSharingTrackExpense) {
            return translate('iou.share');
        }
        if (iouType === CONST.IOU.TYPE.INVOICE) {
            return translate('workspace.invoices.sendInvoice');
        }
        return translate('iou.confirmDetails');
    }, [iouType, translate, isSharingTrackExpense, isCategorizingTrackExpense]);

    const participants = useMemo(
        () =>
            transaction?.participants?.map((participant) => {
                if (participant.isSender && iouType === CONST.IOU.TYPE.INVOICE) {
                    return participant;
                }
                return participant.accountID ? getParticipantsOption(participant, personalDetails) : getReportOption(participant);
            }) ?? [],
        [transaction?.participants, personalDetails, iouType],
    );

    const isPolicyExpenseChat = useMemo(() => participants?.some((participant) => participant.isPolicyExpenseChat), [participants]);
    const formHasBeenSubmitted = useRef(false);

    const confirmModalPrompt = useMemo(() => {
        if (!attachmentInvalidReason) {
            return '';
        }
        if (attachmentInvalidReason === 'attachmentPicker.sizeExceededWithLimit') {
            return translate(attachmentInvalidReason, {maxUploadSizeInMB: CONST.API_ATTACHMENT_VALIDATIONS.RECEIPT_MAX_SIZE / (1024 * 1024)});
        }
        return translate(attachmentInvalidReason);
    }, [attachmentInvalidReason, translate]);

    useFetchRoute(transaction, transaction?.comment?.waypoints, action, shouldUseTransactionDraft(action) ? CONST.TRANSACTION.STATE.DRAFT : CONST.TRANSACTION.STATE.CURRENT);

    useEffect(() => {
        const policyExpenseChat = participants?.find((participant) => participant.isPolicyExpenseChat);
        if (policyExpenseChat?.policyID && policy?.pendingAction !== CONST.RED_BRICK_ROAD_PENDING_ACTION.ADD) {
            openDraftWorkspaceRequest(policyExpenseChat.policyID);
        }
        const senderPolicyParticipant = participants?.find((participant) => !!participant && 'isSender' in participant && participant.isSender);
        if (senderPolicyParticipant?.policyID && policy?.pendingAction !== CONST.RED_BRICK_ROAD_PENDING_ACTION.ADD) {
            openDraftWorkspaceRequest(senderPolicyParticipant.policyID);
        }
    }, [isOffline, participants, policy?.pendingAction]);

    const defaultBillable = !!policy?.defaultBillable;
    useEffect(() => {
        setMoneyRequestBillable(transactionID, defaultBillable);
    }, [transactionID, defaultBillable]);

    useEffect(() => {
        // Exit early if the transaction is still loading
        if (isLoadingTransaction) {
            return;
        }

        // Check if the transaction belongs to the current report
        const isCurrentReportID = transaction?.isFromGlobalCreate
            ? transaction?.participants?.at(0)?.reportID === reportID || (!transaction?.participants?.at(0)?.reportID && transaction?.reportID === reportID)
            : transaction?.reportID === reportID;

        // Exit if the transaction already exists and is associated with the current report
        if (transaction?.transactionID && (!transaction?.isFromGlobalCreate || !isEmptyObject(transaction?.participants)) && (isCurrentReportID || isMovingTransactionFromTrackExpense)) {
            return;
        }

        startMoneyRequest(
            CONST.IOU.TYPE.CREATE,
            // When starting to create an expense from the global FAB, there is not an existing report yet. A random optimistic reportID is generated and used
            // for all of the routes in the creation flow.
            generateReportID(),
        );
        // eslint-disable-next-line react-compiler/react-compiler, react-hooks/exhaustive-deps -- we don't want this effect to run again
    }, [isLoadingTransaction, isMovingTransactionFromTrackExpense]);

    useEffect(() => {
        if (!transaction?.category) {
            return;
        }
        if (policyCategories?.[transaction.category] && !policyCategories[transaction.category].enabled) {
            setMoneyRequestCategory(transactionID, '', policy?.id);
        }
    }, [policy?.id, policyCategories, transaction?.category, transactionID]);

    const policyDistance = Object.values(policy?.customUnits ?? {}).find((customUnit) => customUnit.name === CONST.CUSTOM_UNITS.NAME_DISTANCE);
    const defaultCategory = policyDistance?.defaultCategory ?? '';

    useEffect(() => {
        if (requestType !== CONST.IOU.REQUEST_TYPE.DISTANCE || !!transaction?.category) {
            return;
        }
        setMoneyRequestCategory(transactionID, defaultCategory, policy?.id);
        // Prevent resetting to default when unselect category
        // eslint-disable-next-line react-compiler/react-compiler, react-hooks/exhaustive-deps
    }, [transactionID, requestType, defaultCategory, policy?.id]);

    /**
     * Sets the upload receipt error modal content when an invalid receipt is uploaded
     */
    const setUploadReceiptError = (isInvalid: boolean, title: TranslationPaths, reason: TranslationPaths) => {
        setIsAttachmentInvalid(isInvalid);
        setAttachmentInvalidReasonTitle(title);
        setAttachmentValidReason(reason);
        setPdfFile(null);
    };

    const hideReceiptModal = () => {
        setIsAttachmentInvalid(false);
    };

    /**
     * Sets the Receipt object when dragging and dropping a file
     */
    const setReceiptOnDrop = (originalFile: FileObject, isPdfValidated?: boolean) => {
        validateReceipt(originalFile, setUploadReceiptError).then((isFileValid) => {
            if (!isFileValid) {
                return;
            }

            // If we have a pdf file and if it is not validated then set the pdf file for validation and return
            if (Str.isPDF(originalFile.name ?? '') && !isPdfValidated) {
                setPdfFile(originalFile);
                setIsLoadingReceipt(true);
                return;
            }

            // With the image size > 24MB, we use manipulateAsync to resize the image.
            // It takes a long time so we should display a loading indicator while the resize image progresses.
            if (Str.isImage(originalFile.name ?? '') && (originalFile?.size ?? 0) > CONST.API_ATTACHMENT_VALIDATIONS.MAX_SIZE) {
                setIsLoadingReceipt(true);
            }
            resizeImageIfNeeded(originalFile).then((file) => {
                setIsLoadingReceipt(false);
                // Store the receipt on the transaction object in Onyx
                const source = URL.createObjectURL(file as Blob);
                // eslint-disable-next-line @typescript-eslint/prefer-nullish-coalescing
                setMoneyRequestReceipt(transactionID, source, file.name || '', true);
            });
        });
    };

    const navigateBack = useCallback(() => {
        // If the action is categorize and there's no policies other than personal one, we simply call goBack(), i.e: dismiss the whole flow together
        // We don't need to subscribe to policy_ collection as we only need to check on the latest collection value
        const backTransactionID = isMultiCapture ? '1' : transactionID;
        if (action === CONST.IOU.ACTION.CATEGORIZE) {
            Navigation.goBack();
            return;
        }
        if (isPerDiemRequest) {
            Navigation.goBack(ROUTES.MONEY_REQUEST_STEP_SUBRATE.getRoute(action, iouType, backTransactionID, reportID));
            return;
        }

        if (transaction?.isFromGlobalCreate) {
            // If the participants weren't automatically added to the transaction, then we should go back to the IOURequestStepParticipants.
            if (!transaction?.participantsAutoAssigned && participantsAutoAssignedFromRoute !== 'true') {
                // eslint-disable-next-line @typescript-eslint/prefer-nullish-coalescing
                Navigation.goBack(ROUTES.MONEY_REQUEST_STEP_PARTICIPANTS.getRoute(iouType, backTransactionID, transaction?.reportID || reportID, undefined, action), {compareParams: false});
                return;
            }

            // If the participant was auto-assigned, we need to keep the reportID that is already on the stack.
            // This will allow the user to edit the participant field after going back and forward.
            Navigation.goBack(backTo);
            return;
        }

        // This has selected the participants from the beginning and the participant field shouldn't be editable.
        navigateToStartMoneyRequestStep(requestType, iouType, backTransactionID, reportID, action);
    }, [
        action,
        isPerDiemRequest,
        transaction?.participantsAutoAssigned,
        transaction?.isFromGlobalCreate,
        transaction?.reportID,
        participantsAutoAssignedFromRoute,
        requestType,
        iouType,
        transactionID,
        reportID,
        isMultiCapture,
        backTo,
    ]);

    const navigateToAddReceipt = useCallback(() => {
        Navigation.navigate(ROUTES.MONEY_REQUEST_STEP_SCAN.getRoute(action, iouType, transactionID, reportID, Navigation.getActiveRouteWithoutParams()));
    }, [iouType, transactionID, reportID, action]);

    // When the component mounts, if there is a receipt, see if the image can be read from the disk. If not, redirect the user to the starting step of the flow.
    // This is because until the request is saved, the receipt file is only stored in the browsers memory as a blob:// and if the browser is refreshed, then
    // the image ceases to exist. The best way for the user to recover from this is to start over from the start of the request process.
    // skip this in case user is moving the transaction as the receipt path will be valid in that case
    useEffect(() => {
        Object.values(transactionDrafts ?? {}).forEach((transactionDraft) => {
            if (!transactionDraft?.receipt) {
                return;
            }
            const receiptPath = transactionDraft?.receipt?.source;
            const receiptType = transactionDraft?.receipt?.type;

            const isLocalFile = isLocalFileFileUtils(receiptPath);

            if (!isLocalFile) {
                setReceiptFiles((prevFiles) => ({
                    ...prevFiles,
                    [transactionDraft.transactionID]: {
                        ...transactionDraft.receipt,
                    },
                }));
                return;
            }

            const onSuccess = (file: File) => {
                const receipt: Receipt = file;
                receipt.state = file && requestType === CONST.IOU.REQUEST_TYPE.MANUAL ? CONST.IOU.RECEIPT_STATE.OPEN : CONST.IOU.RECEIPT_STATE.SCANREADY;
                setReceiptFiles((prevFiles) => ({
                    ...prevFiles,
                    [transactionDraft.transactionID]: receipt,
                }));
            };

            navigateToStartStepIfScanFileCannotBeRead(receiptFilename, receiptPath, onSuccess, requestType, iouType, transactionID, reportID, receiptType);
        });
    }, [receiptFilename, requestType, iouType, transactionID, reportID, action, report, participants, transactionDrafts]);

    const requestMoney = useCallback(
        (
            transactionPrams: OnyxEntry<Transaction>,
            selectedParticipants: Participant[],
            trimmedComment: string,
            reportPrams: OnyxEntry<Report>,
            receiptObj?: Receipt,
            gpsPoints?: GpsPoint,
            taxParams?: TaxParams,
            policyParams?: OnyxEntry<Policy>,
            policyTagsParams?: OnyxEntry<PolicyTagLists>,
            policyCategoriesParams?: OnyxEntry<PolicyCategories>,
            shouldNavigate = true,
        ) => {
            if (!transactionPrams) {
                return;
            }

            const participant = selectedParticipants.at(0);
            const {taxCode, taxAmount} = taxParams ?? {};
            if (!participant) {
                return;
            }

            requestMoneyIOUActions({
                report: reportPrams,
                participantParams: {
                    payeeEmail: currentUserPersonalDetails.login,
                    payeeAccountID: currentUserPersonalDetails.accountID,
                    participant,
                },
                policyParams: {
                    policy: policyParams,
                    policyTagList: policyTagsParams,
                    policyCategories: policyCategoriesParams,
                },
                gpsPoints,
                action,
                transactionParams: {
                    amount: transactionPrams.amount,
                    attendees: transactionPrams.attendees,
                    currency: transactionPrams.currency,
                    created: transactionPrams.created,
                    merchant: transactionPrams.merchant,
                    comment: trimmedComment,
                    receipt: receiptObj,
                    category: transactionPrams.category,
                    tag: transactionPrams.tag,
                    taxCode,
                    taxAmount,
                    billable: transactionPrams.billable,
                    actionableWhisperReportActionID: transactionPrams.actionableWhisperReportActionID,
                    linkedTrackedExpenseReportAction: transactionPrams.linkedTrackedExpenseReportAction,
                    linkedTrackedExpenseReportID: transactionPrams.linkedTrackedExpenseReportID,
                    waypoints: Object.keys(transactionPrams.comment?.waypoints ?? {}).length ? getValidWaypoints(transactionPrams.comment?.waypoints, true) : undefined,
                    customUnitRateID,
                },
                shouldNavigate,
            });
        },
        [currentUserPersonalDetails.login, currentUserPersonalDetails.accountID, action, customUnitRateID],
    );

    const submitPerDiemExpense = useCallback(
        (selectedParticipants: Participant[], trimmedComment: string) => {
            if (!transaction) {
                return;
            }

            const participant = selectedParticipants.at(0);
            if (!participant || isEmptyObject(transaction.comment) || isEmptyObject(transaction.comment.customUnit)) {
                return;
            }
            submitPerDiemExpenseIOUActions({
                report,
                participantParams: {
                    payeeEmail: currentUserPersonalDetails.login,
                    payeeAccountID: currentUserPersonalDetails.accountID,
                    participant,
                },
                policyParams: {
                    policy,
                    policyTagList: policyTags,
                    policyCategories,
                },
                transactionParams: {
                    currency: transaction.currency,
                    created: transaction.created,
                    comment: trimmedComment,
                    category: transaction.category,
                    tag: transaction.tag,
                    customUnit: transaction.comment?.customUnit,
                    billable: transaction.billable,
                },
            });
        },
        [report, transaction, currentUserPersonalDetails.login, currentUserPersonalDetails.accountID, policy, policyTags, policyCategories],
    );

    const trackExpense = useCallback(
        (
            transactionParams: OnyxEntry<Transaction>,
            selectedParticipants: Participant[],
            trimmedComment: string,
            reportParams: OnyxEntry<Report>,
            receiptObj?: OnyxEntry<Receipt>,
            gpsPoints?: GpsPoint,
            taxParams?: TaxParams,
            policyParams?: OnyxEntry<Policy>,
            policyTagsParams?: OnyxEntry<PolicyTagLists>,
            policyCategoriesParams?: OnyxEntry<PolicyCategories>,
            shouldNavigate = false,
        ) => {
            if (!reportParams || !transactionParams) {
                return;
            }
            const participant = selectedParticipants.at(0);
            const {taxCode, taxAmount} = taxParams ?? {};
            if (!participant) {
                return;
            }
            trackExpenseIOUActions({
                report: reportParams,
                isDraftPolicy,
                action,
                participantParams: {
                    payeeEmail: currentUserPersonalDetails.login,
                    payeeAccountID: currentUserPersonalDetails.accountID,
                    participant,
                },
                policyParams: {
                    policy: policyParams,
                    policyCategories: policyCategoriesParams,
                    policyTagList: policyTagsParams,
                },
                transactionParams: {
                    amount: transactionParams.amount,
                    currency: transactionParams.currency,
                    created: transactionParams.created,
                    merchant: transactionParams.merchant,
                    comment: trimmedComment,
                    receipt: receiptObj,
                    category: transactionParams.category,
                    tag: transactionParams.tag,
                    taxCode,
                    taxAmount,
                    billable: transactionParams.billable,
                    gpsPoints,
                    validWaypoints: Object.keys(transactionParams?.comment?.waypoints ?? {}).length ? getValidWaypoints(transactionParams.comment?.waypoints, true) : undefined,
                    actionableWhisperReportActionID: transactionParams.actionableWhisperReportActionID,
                    linkedTrackedExpenseReportAction: transactionParams.linkedTrackedExpenseReportAction,
                    linkedTrackedExpenseReportID: transactionParams.linkedTrackedExpenseReportID,
                    customUnitRateID,
                },
                shouldNavigate,
            });
        },
        [currentUserPersonalDetails.login, currentUserPersonalDetails.accountID, action, customUnitRateID, isDraftPolicy],
    );

    const createDistanceRequest = useCallback(
        (selectedParticipants: Participant[], trimmedComment: string) => {
            if (!transaction) {
                return;
            }
            createDistanceRequestIOUActions({
                report,
                participants: selectedParticipants,
                currentUserLogin: currentUserPersonalDetails.login,
                currentUserAccountID: currentUserPersonalDetails.accountID,
                iouType,
                existingTransaction: transaction,
                policyParams: {
                    policy,
                    policyCategories,
                    policyTagList: policyTags,
                },
                transactionParams: {
                    amount: transaction.amount,
                    comment: trimmedComment,
                    created: transaction.created,
                    currency: transaction.currency,
                    merchant: transaction.merchant,
                    category: transaction.category,
                    tag: transaction.tag,
                    taxCode: transactionTaxCode,
                    taxAmount: transactionTaxAmount,
                    customUnitRateID,
                    splitShares: transaction.splitShares,
                    validWaypoints: getValidWaypoints(transaction.comment?.waypoints, true),
                    billable: transaction.billable,
                },
            });
        },
        [policy, policyCategories, policyTags, report, transaction, transactionTaxCode, transactionTaxAmount, customUnitRateID, currentUserPersonalDetails, iouType],
    );

    const createTransaction = useCallback(
        (selectedParticipants: Participant[], locationPermissionGranted = false) => {
            setIsConfirmed(true);
            let splitParticipants = selectedParticipants;

            // Filter out participants with an amount equal to O
            if (iouType === CONST.IOU.TYPE.SPLIT && transaction?.splitShares) {
                const participantsWithAmount = Object.keys(transaction.splitShares ?? {})
                    .filter((accountID: string): boolean => (transaction?.splitShares?.[Number(accountID)]?.amount ?? 0) > 0)
                    .map((accountID) => Number(accountID));
                splitParticipants = selectedParticipants.filter((participant) =>
                    participantsWithAmount.includes(
                        participant.isPolicyExpenseChat ? participant?.ownerAccountID ?? CONST.DEFAULT_NUMBER_ID : participant.accountID ?? CONST.DEFAULT_NUMBER_ID,
                    ),
                );
            }
            const trimmedComment = transaction?.comment?.comment?.trim() ?? '';

            // Don't let the form be submitted multiple times while the navigator is waiting to take the user to a different page
            if (formHasBeenSubmitted.current) {
                return;
            }

            formHasBeenSubmitted.current = true;
            playSound(SOUNDS.DONE);

            if (iouType !== CONST.IOU.TYPE.TRACK && isDistanceRequest && !isMovingTransactionFromTrackExpense) {
                createDistanceRequest(iouType === CONST.IOU.TYPE.SPLIT ? splitParticipants : selectedParticipants, trimmedComment);
                return;
            }

            // IOUs created from a group report will have a reportID param in the route.
            // Since the user is already viewing the report, we don't need to navigate them to the report
            if (iouType === CONST.IOU.TYPE.SPLIT && !transaction?.isFromGlobalCreate && !receiptFiles[0]) {
                if (currentUserPersonalDetails.login && !!transaction) {
                    splitBill({
                        participants: splitParticipants,
                        currentUserLogin: currentUserPersonalDetails.login,
                        currentUserAccountID: currentUserPersonalDetails.accountID,
                        amount: transaction.amount,
                        comment: trimmedComment,
                        currency: transaction.currency,
                        merchant: transaction.merchant,
                        created: transaction.created,
                        category: transaction.category,
                        tag: transaction.tag,
                        existingSplitChatReportID: report?.reportID,
                        billable: transaction.billable,
                        iouRequestType: transaction.iouRequestType,
                        splitShares: transaction.splitShares,
                        splitPayerAccountIDs: transaction.splitPayerAccountIDs ?? [],
                        taxCode: transactionTaxCode,
                        taxAmount: transactionTaxAmount,
                    });
                }
                return;
            }

            // If the split expense is created from the global create menu, we also navigate the user to the group report
            if (iouType === CONST.IOU.TYPE.SPLIT && !receiptFiles[0]) {
                if (currentUserPersonalDetails.login && !!transaction) {
                    splitBillAndOpenReport({
                        participants: splitParticipants,
                        currentUserLogin: currentUserPersonalDetails.login,
                        currentUserAccountID: currentUserPersonalDetails.accountID,
                        amount: transaction.amount,
                        comment: trimmedComment,
                        currency: transaction.currency,
                        merchant: transaction.merchant,
                        created: transaction.created,
                        category: transaction.category,
                        tag: transaction.tag,
                        billable: !!transaction.billable,
                        iouRequestType: transaction.iouRequestType,
                        splitShares: transaction.splitShares,
                        splitPayerAccountIDs: transaction.splitPayerAccountIDs,
                        taxCode: transactionTaxCode,
                        taxAmount: transactionTaxAmount,
                    });
                }
                return;
            }

            if (isPerDiemRequest) {
                submitPerDiemExpense(selectedParticipants, trimmedComment);
                return;
            }

            const transactionLength = Object.keys(transactionDrafts ?? {}).length;
            Object.values(transactionDrafts ?? {}).forEach((transactionDraft, index) => {
                if (!transactionDraft) {
                    return;
                }
                const transactionDraftTaxCode = (transactionDraft?.taxCode ? transactionDraft?.taxCode : defaultTaxCode) ?? '';
                const transactionDraftTaxAmount = transactionDraft?.taxAmount ?? 0;
                const trimmedDraftComment = transactionDraft?.comment?.comment?.trim() ?? '';
                const receiptFile = receiptFiles[transactionDraft.transactionID];
                const selectedParticipantsDraft = transactionDraft.participants ?? [];

                const reportPrams = getReportOrDraftReport(transactionDraft?.reportID);
                const policyPrams = getPolicy(getIOURequestPolicyID(transactionDraft, reportPrams));
                const policyTagsPrams = getPolicyTagsData(policyPrams?.id);
                const policyCategoriesPrams = getPolicyCategoriesData(policyPrams?.id);

                if (receiptFile) {
                    receiptFile.state = requestType === CONST.IOU.REQUEST_TYPE.MANUAL ? CONST.IOU.RECEIPT_STATE.OPEN : CONST.IOU.RECEIPT_STATE.SCANREADY;
                }

                const shouldNavigate = transactionLength === index + 1;
                // If we have a receipt let's start the split expense by creating only the action, the transaction, and the group DM if needed
                if (iouType === CONST.IOU.TYPE.SPLIT && receiptFile) {
                    if (currentUserPersonalDetails.login && !!transactionDraft) {
                        startSplitBill({
                            participants: selectedParticipantsDraft,
                            currentUserLogin: currentUserPersonalDetails.login,
                            currentUserAccountID: currentUserPersonalDetails.accountID,
                            comment: trimmedDraftComment,
                            receipt: receiptFile,
                            existingSplitChatReportID: report?.reportID,
                            billable: transactionDraft.billable,
                            category: transactionDraft.category,
                            tag: transactionDraft.tag,
                            currency: transactionDraft.currency,
                            taxCode: transactionDraftTaxCode,
                            taxAmount: transactionDraftTaxAmount,
                            shouldNavigate,
                        });
                    }
                    return;
                }

                if (iouType === CONST.IOU.TYPE.INVOICE) {
                    sendInvoice(currentUserPersonalDetails.accountID, transactionDraft, reportPrams, receiptFile, policyPrams, policyTagsPrams, policyCategoriesPrams);
                    return;
                }

                if (iouType === CONST.IOU.TYPE.TRACK || isCategorizingTrackExpense || isSharingTrackExpense) {
                    if (receiptFile && transactionDraft) {
                        // If the transaction amount is zero, then the money is being requested through the "Scan" flow and the GPS coordinates need to be included.
                        if (transactionDraft.amount === 0 && !isSharingTrackExpense && !isCategorizingTrackExpense && locationPermissionGranted) {
                            if (userLocation) {
                                trackExpense(
                                    transactionDraft,
                                    selectedParticipantsDraft,
                                    trimmedDraftComment,
                                    reportPrams,
                                    receiptFile,
                                    {
                                        lat: userLocation.latitude,
                                        long: userLocation.longitude,
                                    },
                                    {
                                        taxCode: transactionDraftTaxCode,
                                        taxAmount: transactionDraftTaxAmount,
                                    },
                                    policyPrams,
                                    policyTagsPrams,
                                    policyCategoriesPrams,
                                    shouldNavigate,
                                );
                                return;
                            }

                            getCurrentPosition(
                                (successData) => {
                                    trackExpense(
                                        transactionDraft,
                                        selectedParticipantsDraft,
                                        trimmedDraftComment,
                                        reportPrams,
                                        receiptFile,
                                        {
                                            lat: successData.coords.latitude,
                                            long: successData.coords.longitude,
                                        },
                                        {
                                            taxCode: transactionDraftTaxCode,
                                            taxAmount: transactionDraftTaxAmount,
                                        },
                                        policyPrams,
                                        policyTagsPrams,
                                        policyCategoriesPrams,
                                        shouldNavigate,
                                    );
                                },
                                (errorData) => {
                                    Log.info('[IOURequestStepConfirmation] getCurrentPosition failed', false, errorData);
                                    // When there is an error, the money can still be requested, it just won't include the GPS coordinates
                                    trackExpense(
                                        transactionDraft,
                                        selectedParticipantsDraft,
                                        trimmedDraftComment,
                                        reportPrams,
                                        receiptFile,
                                        undefined,
                                        {
                                            taxCode: transactionDraftTaxCode,
                                            taxAmount: transactionDraftTaxAmount,
                                        },
                                        policyPrams,
                                        policyTagsPrams,
                                        policyCategoriesPrams,
                                        shouldNavigate,
                                    );
                                },
                                {
                                    maximumAge: CONST.GPS.MAX_AGE,
                                    timeout: CONST.GPS.TIMEOUT,
                                },
                            );
                            return;
                        }

                        // Otherwise, the money is being requested through the "Manual" flow with an attached image and the GPS coordinates are not needed.
                        trackExpense(
                            transactionDraft,
                            selectedParticipantsDraft,
                            trimmedDraftComment,
                            reportPrams,
                            receiptFile,
                            undefined,
                            {
                                taxCode: transactionDraftTaxCode,
                                taxAmount: transactionDraftTaxAmount,
                            },
                            policyPrams,
                            policyTagsPrams,
                            policyCategoriesPrams,
                            shouldNavigate,
                        );
                        return;
                    }
                    trackExpense(
                        transactionDraft,
                        selectedParticipantsDraft,
                        trimmedDraftComment,
                        reportPrams,
                        receiptFile,
                        undefined,
                        {
                            taxCode: transactionDraftTaxCode,
                            taxAmount: transactionDraftTaxAmount,
                        },
                        policyPrams,
                        policyTagsPrams,
                        policyCategoriesPrams,
                        shouldNavigate,
                    );
                    return;
                }

                if (receiptFile && !!transactionDraft) {
                    // If the transaction amount is zero, then the money is being requested through the "Scan" flow and the GPS coordinates need to be included.
                    if (
                        transactionDraft.amount === 0 &&
                        !isSharingTrackExpense &&
                        !isCategorizingTrackExpense &&
                        locationPermissionGranted &&
                        !selectedParticipants.some((participant) => isSelectedManagerMcTest(participant.login))
                    ) {
                        if (userLocation) {
                            requestMoney(
                                transactionDraft,
                                selectedParticipantsDraft,
                                trimmedDraftComment,
                                reportPrams,
                                receiptFile,
                                {
                                    lat: userLocation.latitude,
                                    long: userLocation.longitude,
                                },
                                {
                                    taxCode: transactionDraftTaxCode,
                                    taxAmount: transactionDraftTaxAmount,
                                },
                                policyPrams,
                                policyTagsPrams,
                                policyCategoriesPrams,
                                shouldNavigate,
                            );
                            return;
                        }

                        getCurrentPosition(
                            (successData) => {
                                requestMoney(
                                    transactionDraft,
                                    selectedParticipantsDraft,
                                    trimmedDraftComment,
                                    reportPrams,
                                    receiptFile,
                                    {
                                        lat: successData.coords.latitude,
                                        long: successData.coords.longitude,
                                    },
                                    {
                                        taxCode: transactionDraftTaxCode,
                                        taxAmount: transactionDraftTaxAmount,
                                    },
                                    policyPrams,
                                    policyTagsPrams,
                                    policyCategoriesPrams,
                                    shouldNavigate,
                                );
                            },
                            (errorData) => {
                                Log.info('[IOURequestStepConfirmation] getCurrentPosition failed', false, errorData);
                                // When there is an error, the money can still be requested, it just won't include the GPS coordinates
                                requestMoney(
                                    transactionDraft,
                                    selectedParticipantsDraft,
                                    trimmedDraftComment,
                                    reportPrams,
                                    receiptFile,
                                    undefined,
                                    {
                                        taxCode: transactionDraftTaxCode,
                                        taxAmount: transactionDraftTaxAmount,
                                    },
                                    policyPrams,
                                    policyTagsPrams,
                                    policyCategoriesPrams,
                                    shouldNavigate,
                                );
                            },
                            {
                                maximumAge: CONST.GPS.MAX_AGE,
                                timeout: CONST.GPS.TIMEOUT,
                            },
                        );
                        return;
                    }
                    // Otherwise, the money is being requested through the "Manual" flow with an attached image and the GPS coordinates are not needed.
                    requestMoney(
                        transactionDraft,
                        selectedParticipantsDraft,
                        trimmedDraftComment,
                        reportPrams,
                        receiptFile,
                        undefined,
                        {
                            taxCode: transactionDraftTaxCode,
                            taxAmount: transactionDraftTaxAmount,
                        },
                        policyPrams,
                        policyTagsPrams,
                        policyCategoriesPrams,
                        shouldNavigate,
                    );
                    return;
                }

                requestMoney(
                    transactionDraft,
                    selectedParticipantsDraft,
                    trimmedDraftComment,
                    reportPrams,
                    undefined,
                    {
                        taxCode: transactionDraftTaxCode,
                        taxAmount: transactionDraftTaxAmount,
                    },
                    policyPrams,
                    policyTagsPrams,
                    policyCategoriesPrams,
                );
            });
        },
        [
            iouType,
            transactionDrafts,
            isDistanceRequest,
            isMovingTransactionFromTrackExpense,
            receiptFiles,
            isCategorizingTrackExpense,
            isSharingTrackExpense,
            isPerDiemRequest,
            requestMoney,
            createDistanceRequest,
            currentUserPersonalDetails.login,
            currentUserPersonalDetails.accountID,
            report,
            transactionTaxCode,
            transactionTaxAmount,
            trackExpense,
            submitPerDiemExpense,
            userLocation,
            defaultTaxCode,
            requestType,
            transaction,
        ],
    );

    /**
     * Checks if user has a GOLD wallet then creates a paid IOU report on the fly
     */
    const sendMoney = useCallback(
        (paymentMethod: PaymentMethodType | undefined) => {
            const currency = transaction?.currency;
            const trimmedComment = transaction?.comment?.comment?.trim() ?? '';
            const participant = participants?.at(0);

            if (!participant || !transaction?.amount || !currency) {
                return;
            }

            if (paymentMethod === CONST.IOU.PAYMENT_TYPE.ELSEWHERE) {
                setIsConfirmed(true);
                sendMoneyElsewhere(report, transaction.amount, currency, trimmedComment, currentUserPersonalDetails.accountID, participant);
                return;
            }

            if (paymentMethod === CONST.IOU.PAYMENT_TYPE.EXPENSIFY) {
                setIsConfirmed(true);
                sendMoneyWithWallet(report, transaction.amount, currency, trimmedComment, currentUserPersonalDetails.accountID, participant);
            }
        },
        [transaction?.amount, transaction?.comment, transaction?.currency, participants, currentUserPersonalDetails.accountID, report],
    );

    const setBillable = useCallback(
        (billable: boolean) => {
            setMoneyRequestBillable(transactionID, billable);
        },
        [transactionID],
    );

    // This loading indicator is shown because the transaction originalCurrency is being updated later than the component mounts.
    // To prevent the component from rendering with the wrong currency, we show a loading indicator until the correct currency is set.
    const isLoading = !!transaction?.originalCurrency;

    const onConfirm = (listOfParticipants: Participant[]) => {
        setIsConfirming(true);
        setSelectedParticipantList(listOfParticipants);

        if (gpsRequired) {
            const shouldStartLocationPermissionFlow =
                !lastLocationPermissionPrompt ||
                (DateUtils.isValidDateString(lastLocationPermissionPrompt ?? '') &&
                    DateUtils.getDifferenceInDaysFromNow(new Date(lastLocationPermissionPrompt ?? '')) > CONST.IOU.LOCATION_PERMISSION_PROMPT_THRESHOLD_DAYS);

            if (shouldStartLocationPermissionFlow) {
                setStartLocationPermissionFlow(true);
                return;
            }
        }

        createTransaction(listOfParticipants);
        setIsConfirming(false);
    };

    if (isLoadingTransaction) {
        return <FullScreenLoadingIndicator />;
    }

    const PDFThumbnailView = pdfFile ? (
        <PDFThumbnail
            style={styles.invisiblePDF}
            previewSourceURL={pdfFile.uri ?? ''}
            onLoadSuccess={() => {
                setPdfFile(null);
                setIsLoadingReceipt(false);
                setReceiptOnDrop(pdfFile, true);
            }}
            onPassword={() => {
                setIsLoadingReceipt(false);
                setUploadReceiptError(true, 'attachmentPicker.attachmentError', 'attachmentPicker.protectedPDFNotSupported');
            }}
            onLoadError={() => {
                setIsLoadingReceipt(false);
                setUploadReceiptError(true, 'attachmentPicker.attachmentError', 'attachmentPicker.errorWhileSelectingCorruptedAttachment');
            }}
        />
    ) : null;

    const shouldShowThreeDotsButton =
        requestType === CONST.IOU.REQUEST_TYPE.MANUAL && (iouType === CONST.IOU.TYPE.SUBMIT || iouType === CONST.IOU.TYPE.TRACK) && !isMovingTransactionFromTrackExpense;

    return (
        <ScreenWrapper
            shouldEnableMaxHeight={canUseTouchScreen()}
            testID={IOURequestStepConfirmation.displayName}
            headerGapStyles={isDraggingOver ? [styles.isDraggingOver] : []}
        >
            <DragAndDropProvider
                setIsDraggingOver={setIsDraggingOver}
                isDisabled={!shouldShowThreeDotsButton}
            >
                <View style={styles.flex1}>
                    <HeaderWithBackButton
                        title={headerTitle}
                        onBackButtonPress={navigateBack}
                        shouldShowThreeDotsButton={shouldShowThreeDotsButton}
                        threeDotsAnchorPosition={threeDotsAnchorPosition}
                        threeDotsMenuItems={[
                            {
                                icon: Expensicons.Receipt,
                                text: translate('receipt.addReceipt'),
                                onSelected: navigateToAddReceipt,
                            },
                        ]}
                    >
                        {!!isMultiCapture && (
                            <EducationalTooltip
                                shouldRender={shouldShowProductTrainingTooltip}
                                renderTooltipContent={renderProductTrainingTooltip}
                                anchorAlignment={{
                                    horizontal: CONST.MODAL.ANCHOR_ORIGIN_HORIZONTAL.RIGHT,
                                    vertical: CONST.MODAL.ANCHOR_ORIGIN_VERTICAL.TOP,
                                }}
                                shiftHorizontal={-14}
                                wrapperStyle={styles.productTrainingTooltipWrapper}
                                shouldHideOnNavigate
                            >
                                <View style={[styles.flexRow, styles.gap1]}>
                                    <Button
                                        accessibilityLabel="back"
                                        style={[styles.highlightBG, styles.borderRadiusNormal, styles.justifyContentCenter, styles.alignItemsCenter, styles.multiScanNavigateButton]}
                                        isDisabled={transactionID === '1'}
                                        onPress={() => {
                                            Navigation.goBack(
                                                ROUTES.MONEY_REQUEST_STEP_CONFIRMATION.getRoute(
                                                    action,
                                                    iouType,
                                                    `${parseInt(transactionID, 10) - 1}`,
                                                    reportID,
                                                    undefined,
                                                    isMultiCapture,
                                                    backTo,
                                                ),
                                            );
                                        }}
                                        small
                                        icon={Expensicons.ArrowRight}
                                        iconStyles={styles.flipUpsideDown}
                                    />
                                    <Button
                                        accessibilityLabel="forward"
                                        style={[styles.highlightBG, styles.borderRadiusNormal, styles.justifyContentCenter, styles.alignItemsCenter, styles.multiScanNavigateButton]}
                                        isDisabled={transactionID === totalTransactions.toString()}
                                        onPress={() => {
                                            Navigation.navigate(
                                                ROUTES.MONEY_REQUEST_STEP_CONFIRMATION.getRoute(
                                                    action,
                                                    iouType,
                                                    `${parseInt(transactionID, 10) + 1}`,
                                                    reportID,
                                                    undefined,
                                                    isMultiCapture,
                                                    backTo,
                                                ),
                                            );
                                        }}
                                        small
                                        icon={Expensicons.ArrowRight}
                                    />
                                </View>
                            </EducationalTooltip>
                        )}
                    </HeaderWithBackButton>
                    {(isLoading || isLoadingReceipt) && <FullScreenLoadingIndicator />}
                    {PDFThumbnailView}
                    <ReceiptDropUI
                        onDrop={(e) => {
                            const file = e?.dataTransfer?.files[0];
                            if (file) {
                                file.uri = URL.createObjectURL(file);
                                setReceiptOnDrop(file);
                            }
                        }}
                    />
                    <ConfirmModal
                        title={attachmentInvalidReasonTitle ? translate(attachmentInvalidReasonTitle) : ''}
                        onConfirm={hideReceiptModal}
                        onCancel={hideReceiptModal}
                        isVisible={isAttachmentInvalid}
                        prompt={confirmModalPrompt}
                        confirmText={translate('common.close')}
                        shouldShowCancelButton={false}
                    />
                    {!!gpsRequired && (
                        <LocationPermissionModal
                            startPermissionFlow={startLocationPermissionFlow}
                            resetPermissionFlow={() => setStartLocationPermissionFlow(false)}
                            onGrant={() => {
                                navigateAfterInteraction(() => {
                                    createTransaction(selectedParticipantList, true);
                                });
                            }}
                            onDeny={() => {
                                updateLastLocationPermissionPrompt();
                                navigateAfterInteraction(() => {
                                    createTransaction(selectedParticipantList, false);
                                });
                            }}
                            onInitialGetLocationCompleted={() => {
                                setIsConfirming(false);
                            }}
                        />
                    )}
                    <MoneyRequestConfirmationList
                        transaction={transaction}
                        selectedParticipants={participants}
                        iouAmount={Math.abs(transaction?.amount ?? 0)}
                        iouAttendees={transaction?.attendees ?? []}
                        iouComment={transaction?.comment?.comment ?? ''}
                        iouCurrencyCode={transaction?.currency}
                        iouIsBillable={transaction?.billable}
                        onToggleBillable={setBillable}
                        iouCategory={transaction?.category}
                        onConfirm={onConfirm}
                        onSendMoney={sendMoney}
                        receiptPath={receiptFiles[transactionID]?.source}
                        receiptFilename={receiptFiles[transactionID]?.name}
                        iouType={iouType}
                        reportID={reportID}
                        isPolicyExpenseChat={isPolicyExpenseChat}
                        policyID={getIOURequestPolicyID(transaction, report)}
                        bankAccountRoute={getBankAccountRoute(report)}
                        iouMerchant={transaction?.merchant}
                        iouCreated={transaction?.created}
                        isDistanceRequest={isDistanceRequest}
                        isPerDiemRequest={isPerDiemRequest}
                        shouldShowSmartScanFields={isMovingTransactionFromTrackExpense ? transaction?.amount !== 0 : requestType !== CONST.IOU.REQUEST_TYPE.SCAN}
                        action={action}
                        payeePersonalDetails={payeePersonalDetails}
                        shouldPlaySound={iouType === CONST.IOU.TYPE.PAY}
                        isConfirmed={isConfirmed}
                        isConfirming={isConfirming}
                        isMultiCapture={isMultiCapture}
                        totalTransactions={totalTransactions}
                    />
                </View>
            </DragAndDropProvider>
        </ScreenWrapper>
    );
}

IOURequestStepConfirmation.displayName = 'IOURequestStepConfirmation';

/* eslint-disable rulesdir/no-negated-variables */
const IOURequestStepConfirmationWithFullTransactionOrNotFound = withFullTransactionOrNotFound(IOURequestStepConfirmation);
/* eslint-disable rulesdir/no-negated-variables */
const IOURequestStepConfirmationWithWritableReportOrNotFound = withWritableReportOrNotFound(IOURequestStepConfirmationWithFullTransactionOrNotFound);
export default IOURequestStepConfirmationWithWritableReportOrNotFound;
