import lodashGet from 'lodash/get';
import PropTypes from 'prop-types';
import React from 'react';
import {View} from 'react-native';
import {withOnyx} from 'react-native-onyx';
import OfflineWithFeedback from '@components/OfflineWithFeedback';
import withLocalize from '@components/withLocalize';
import withWindowDimensions, {windowDimensionsPropTypes} from '@components/withWindowDimensions';
import useStyleUtils from '@hooks/useStyleUtils';
import useThemeStyles from '@hooks/useThemeStyles';
import compose from '@libs/compose';
import reportPropTypes from '@pages/reportPropTypes';
import * as Report from '@userActions/Report';
import ONYXKEYS from '@src/ONYXKEYS';
import AnimatedEmptyStateBackground from './AnimatedEmptyStateBackground';
import ReportActionItem from './ReportActionItem';
import reportActionPropTypes from './reportActionPropTypes';
import { getAllParentReportActions } from '@libs/ReportUtils';
import Navigation from '@libs/Navigation/Navigation';
import ROUTES from '@src/ROUTES';

const propTypes = {
    /** Flag to show, hide the thread divider line */
    shouldHideThreadDividerLine: PropTypes.bool,

    /** The id of the report */
    reportID: PropTypes.string.isRequired,

    /** The id of the parent report */
    // eslint-disable-next-line react/no-unused-prop-types
    parentReportID: PropTypes.string.isRequired,

    /** ONYX PROPS */

    /** The report currently being looked at */
    report: reportPropTypes,

    /** The actions from the parent report */
    // TO DO: Replace with HOC https://github.com/Expensify/App/issues/18769.
    parentReportActions: PropTypes.objectOf(PropTypes.shape(reportActionPropTypes)),

    ...windowDimensionsPropTypes,
};
const defaultProps = {
    report: {},
    parentReportActions: {},
    shouldHideThreadDividerLine: false,
};

function ReportActionItemParentAction(props) {
    const styles = useThemeStyles();
    const StyleUtils = useStyleUtils();

    const allParents = getAllParentReportActions(props.report);
    return (
        <View style={StyleUtils.getReportWelcomeContainerStyle(props.isSmallScreenWidth)}>
            <AnimatedEmptyStateBackground />
            <View style={[styles.p5, StyleUtils.getReportWelcomeTopMarginStyle(props.isSmallScreenWidth)]} />
            {allParents.reverse().map((parent, index) => {
                return (
                    <OfflineWithFeedback
                        shouldDisableOpacity={Boolean(lodashGet(parent.reportAction, 'pendingAction'))}
                        pendingAction={lodashGet(parent.report, 'pendingFields.addWorkspaceRoom') || lodashGet(parent.report, 'pendingFields.createChat')}
                        errors={lodashGet(parent.report, 'errorFields.addWorkspaceRoom') || lodashGet(parent.report, 'errorFields.createChat')}
                        errorRowStyles={[styles.ml10, styles.mr2]}
                        onClose={() => Report.navigateToConciergeChatAndDeleteReport(parent.report.reportID)}
                    >
                        <ReportActionItem
                            onPress={() => Navigation.navigate(ROUTES.REPORT_WITH_ID.getRoute(parent.report.reportID))}
                            report={parent.report}
                            action={parent.reportAction}
                            displayAsGroup={false}
                            isMostRecentIOUReportAction={false}
                            shouldDisplayNewMarker={props.shouldDisplayNewMarker}
                            index={index}
                        />
                        <View style={[styles.threadDividerLine]} />
                    </OfflineWithFeedback>
                )
            })}
        </View>
    );
}

ReportActionItemParentAction.defaultProps = defaultProps;
ReportActionItemParentAction.propTypes = propTypes;
ReportActionItemParentAction.displayName = 'ReportActionItemParentAction';

export default compose(
    withWindowDimensions,
    withLocalize,
    withOnyx({
        report: {
            key: ({reportID}) => `${ONYXKEYS.COLLECTION.REPORT}${reportID}`,
        },
        // We should subscribe all report actions here to dynamic update when any parent report action is changed
        allReportActions: {
            key: ONYXKEYS.COLLECTION.REPORT_ACTIONS
        }
    }),
)(ReportActionItemParentAction);
