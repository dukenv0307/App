import AttachmentModal from '@components/AttachmentModal';
import withLocalize, {withLocalizePropTypes} from '@components/withLocalize';
import Navigation from '@libs/Navigation/Navigation';
import * as UserUtils from '@libs/UserUtils';
import compose from '@libs/compose';
import ONYXKEYS from '@src/ONYXKEYS';
import ROUTES from '@src/ROUTES';
import lodashGet from 'lodash/get';
import PropTypes from 'prop-types';
import React from 'react';
import {withOnyx} from 'react-native-onyx';

const propTypes = {
    /** React Navigation route */
    route: PropTypes.shape({
        /** Params from the route */
        params: PropTypes.shape({
            /** The acountID of the user */
            accountID: PropTypes.string.isRequired,
        }),
    }).isRequired,
    ...withLocalizePropTypes,
};

function ProfileAvatar(props) {
    const personalDetail = props.personalDetails[props.route.params.accountID];
    const avatarURL = lodashGet(personalDetail, 'avatar', '');
    const accountID = lodashGet(personalDetail, 'accountID', '');

    return (
        <AttachmentModal
            headerTitle={personalDetail.displayName}
            defaultOpen
            source={UserUtils.getAvatar(avatarURL, accountID)}
            onModalClose={() => {
                Navigation.goBack(ROUTES.SETTINGS_PROFILE);
            }}
        />
    );
}

ProfileAvatar.propTypes = propTypes;
ProfileAvatar.displayName = 'ProfileAvatar';

export default compose(
    withLocalize,
    withOnyx({
        personalDetails: {
            key: ONYXKEYS.PERSONAL_DETAILS_LIST,
        },
    }),
)(ProfileAvatar);
