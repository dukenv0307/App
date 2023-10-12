import React from 'react';
import PropTypes from 'prop-types';
import lodashGet from 'lodash/get';
import {withOnyx} from 'react-native-onyx';
import AttachmentModal from '../../components/AttachmentModal';
import Navigation from '../../libs/Navigation/Navigation';
import withLocalize, {withLocalizePropTypes} from '../../components/withLocalize';
import compose from '../../libs/compose';
import ONYXKEYS from '../../ONYXKEYS';
import * as ReportUtils from '../../libs/ReportUtils';

/**
 * @param {Object} route
 * @returns {String}
 */
function getPolicyIDFromRoute(route) {
    return lodashGet(route, 'params.policyID', '');
}

const propTypes = {
    /** React Navigation route */
    route: PropTypes.shape({
        /** Params from the route */
        params: PropTypes.shape({
            /** The acount ID of the user */
            policyID: PropTypes.string.isRequired,
        }),
    }).isRequired,
    /** The policy object for the current route */
    policy: PropTypes.shape({
        /** The ID of the policy */
        id: PropTypes.string,

        /** The name of the policy */
        name: PropTypes.string,

        /** The URL for the policy avatar */
        avatar: PropTypes.string,
    }).isRequired,
    ...withLocalizePropTypes,
};

function ProfileAttachment(props) {
    return (
        <AttachmentModal
            headerTitle={lodashGet(props.policy, 'name', '')}
            defaultOpen
            source={lodashGet(props.policy, 'avatar', '') || ReportUtils.getDefaultWorkspaceAvatar(lodashGet(props.policy, 'name', ''))}
            onModalClose={() => {
                Navigation.goBack();
            }}
        />
    );
}

ProfileAttachment.propTypes = propTypes;
ProfileAttachment.displayName = 'ProfileAttachment';

export default compose(
    withLocalize,
    withOnyx({
        policy: {
            key: (props) => `${ONYXKEYS.COLLECTION.POLICY}${getPolicyIDFromRoute(props.route)}`,
        },
    }),
)(ProfileAttachment);
