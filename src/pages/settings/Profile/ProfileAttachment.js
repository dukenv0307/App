import React from 'react';
import PropTypes from 'prop-types';
import _ from 'underscore';
import AttachmentModal from '../../../components/AttachmentModal';
import Navigation from '../../../libs/Navigation/Navigation';
import ROUTES from '../../../ROUTES';
import withLocalize, {withLocalizePropTypes} from '../../../components/withLocalize';

const propTypes = {
    /** Navigation route context info provided by react navigation */
    route: PropTypes.shape({
        /** Route specific parameters used on this screen */
        params: PropTypes.shape({
            /** The uri encoded source of the attachment */
            source: PropTypes.string.isRequired,
        }).isRequired,
    }).isRequired,
    ...withLocalizePropTypes,
};

function ProfileAttachment(props) {
    const source = decodeURI(_.get(props, ['route', 'params', 'source']));

    return (
        <AttachmentModal
            headerTitle={props.translate('profilePage.profileAvatar')}
            defaultOpen
            source={source}
            onModalClose={() => {
                Navigation.goBack(ROUTES.SETTINGS_PROFILE);
            }}
        />
    );
}

ProfileAttachment.propTypes = propTypes;
ProfileAttachment.displayName = 'ProfileAttachment';

export default withLocalize(ProfileAttachment);
