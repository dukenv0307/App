import React from 'react';
import PropTypes from 'prop-types';
import lodashGet from 'lodash/get';
import {withOnyx} from 'react-native-onyx';
import AttachmentModal from '../../../components/AttachmentModal';
import Navigation from '../../../libs/Navigation/Navigation';
import ROUTES from '../../../ROUTES';
import withLocalize, {withLocalizePropTypes} from '../../../components/withLocalize';
import compose from '../../../libs/compose';
import * as UserUtils from '../../../libs/UserUtils';
import ONYXKEYS from '../../../ONYXKEYS';

const propTypes = {
    /** React Navigation route */
    route: PropTypes.shape({
        /** Params from the route */
        params: PropTypes.shape({
            /** The acount ID of the user */
            accountID: PropTypes.string.isRequired,
        }),
    }).isRequired,
    ...withLocalizePropTypes,
};

function ProfileAttachment(props) {
    const personalDetail = props.personalDetails[props.route.params.accountID];
    const avatarURL = lodashGet(personalDetail, 'avatar', '');
    const accountID = lodashGet(personalDetail, 'accountID', '');

    return (
        <AttachmentModal
            headerTitle={props.translate('profilePage.profileAvatar')}
            defaultOpen
            source={UserUtils.getAvatar(avatarURL, accountID)}
            onModalClose={() => {
                Navigation.goBack(ROUTES.SETTINGS_PROFILE);
            }}
        />
    );
}

ProfileAttachment.propTypes = propTypes;
ProfileAttachment.displayName = 'ProfileAttachment';

export default compose(
    withLocalize,
    withOnyx({
        personalDetails: {
            key: ONYXKEYS.PERSONAL_DETAILS_LIST,
        },
    }),
)(ProfileAttachment);
