import React from 'react';
import {
  Alert,
  Button,
  ControlLabel,
  FormControl,
  FormGroup,
  Glyphicon,
  HelpBlock,
  InputGroup,
  Modal,
  OverlayTrigger,
  Panel,
  ProgressBar,
  Tooltip,
  Well,
} from 'react-bootstrap';
import PropTypes from 'prop-types';
import copy from 'copy-to-clipboard';
import * as web3 from '@solana/web3.js';

import {Account} from './account';
import {Settings} from './settings';

class PublicKeyInput extends React.Component {
  state = {
    value: '',
    validationState: null,
  };

  componentDidMount() {
    this.handleChange(this.props.defaultValue || '');
  }

  getValidationState(value) {
    const length = value.length;
    if (length === 44) {
      if (value.match(/^[A-Za-z0-9]+$/)) {
        return 'success';
      }
      return 'error';
    } else if (length > 44) {
      return 'error';
    } else if (length > 0) {
      return 'warning';
    }
    return null;
  }

  handleChange(value) {
    const validationState = this.getValidationState(value);
    this.setState({value, validationState});
    this.props.onPublicKey(validationState === 'success' ? value : null);
  }

  render() {
    return (
      <form>
        <FormGroup validationState={this.state.validationState}>
          <ControlLabel>Recipient&apos;s Public Key</ControlLabel>
          <FormControl
            type="text"
            value={this.state.value}
            placeholder="Enter the public key of the recipient"
            onChange={e => this.handleChange(e.target.value)}
          />
          <FormControl.Feedback />
        </FormGroup>
      </form>
    );
  }
}
PublicKeyInput.propTypes = {
  onPublicKey: PropTypes.func,
  defaultValue: PropTypes.string,
};

class TokenInput extends React.Component {
  state = {
    value: '',
    validationState: null,
    help: '',
  };

  componentDidMount() {
    this.handleChange(this.props.defaultValue || '');
  }

  getValidationState(value) {
    if (value.length === 0) {
      return [null, ''];
    }
    if (parseInt(value) > this.props.maxValue) {
      return ['error', 'Insufficient funds'];
    }
    if (value.match(/^\d+$/)) {
      return ['success', ''];
    }
    return ['error', 'Not a valid number'];
  }

  handleChange(value) {
    const [validationState, help] = this.getValidationState(value);
    this.setState({value, validationState, help});
    this.props.onAmount(validationState === 'success' ? value : null);
  }

  render() {
    return (
      <form>
        <FormGroup validationState={this.state.validationState}>
          <ControlLabel>Amount</ControlLabel>
          <FormControl
            type="text"
            value={this.state.value}
            placeholder="Enter amount to transfer"
            onChange={e => this.handleChange(e.target.value)}
          />
          <HelpBlock>{this.state.help}</HelpBlock>
          <FormControl.Feedback />
        </FormGroup>
      </form>
    );
  }
}
TokenInput.propTypes = {
  onAmount: PropTypes.func,
  defaultValue: PropTypes.string,
  maxValue: PropTypes.number,
};

class SignatureInput extends React.Component {
  state = {
    value: '',
    validationState: null,
  };

  getValidationState(value) {
    const length = value.length;
    if (length === 88) {
      if (value.match(/^[A-Za-z0-9]+$/)) {
        return 'success';
      }
      return 'error';
    } else if (length > 44) {
      return 'error';
    } else if (length > 0) {
      return 'warning';
    }
    return null;
  }

  handleChange(e) {
    const {value} = e.target;
    const validationState = this.getValidationState(value);
    this.setState({value, validationState});
    this.props.onSignature(validationState === 'success' ? value : null);
  }

  render() {
    return (
      <form>
        <FormGroup validationState={this.state.validationState}>
          <ControlLabel>Signature</ControlLabel>
          <FormControl
            type="text"
            value={this.state.value}
            placeholder="Enter a transaction signature"
            onChange={e => this.handleChange(e)}
          />
          <FormControl.Feedback />
        </FormGroup>
      </form>
    );
  }
}
SignatureInput.propTypes = {
  onSignature: PropTypes.func,
};

class DismissibleMessages extends React.Component {
  render() {
    const messages = this.props.messages.map(([msg, style], index) => {
      return (
        <Alert key={index} bsStyle={style}>
          <a href="#" onClick={() => this.props.onDismiss(index)}>
            <Glyphicon glyph="remove-sign" />
          </a>{' '}
          &nbsp;
          {msg}
        </Alert>
      );
    });
    return <div>{messages}</div>;
  }
}
DismissibleMessages.propTypes = {
  messages: PropTypes.array,
  onDismiss: PropTypes.func,
};

class BusyModal extends React.Component {
  render() {
    return (
      <Modal
        {...this.props}
        bsSize="small"
        aria-labelledby="contained-modal-title-sm"
      >
        <Modal.Header>
          <Modal.Title id="contained-modal-title-sm">
            {this.props.title}
          </Modal.Title>
        </Modal.Header>
        <Modal.Body>
          {this.props.text}
          <br />
          <br />
          <ProgressBar active now={100} />
        </Modal.Body>
      </Modal>
    );
  }
}
BusyModal.propTypes = {
  title: PropTypes.string,
  text: PropTypes.string,
};

class SettingsModal extends React.Component {
  render() {
    return (
      <Modal
        {...this.props}
        bsSize="large"
        aria-labelledby="contained-modal-title-lg"
      >
        <Modal.Header closeButton>
          <Modal.Title id="contained-modal-title-lg">Settings</Modal.Title>
        </Modal.Header>
        <Modal.Body>
          <Settings store={this.props.store} onHide={this.props.onHide} />
        </Modal.Body>
        <Modal.Footer>
          <Button onClick={this.props.onHide}>Close</Button>
        </Modal.Footer>
      </Modal>
    );
  }
}
SettingsModal.propTypes = {
  onHide: PropTypes.func,
  store: PropTypes.object,
};

export class Wallet extends React.Component {
  state = {
    messages: [],
    busyModal: null,
    settingsModal: false,
    balance: 0,
    account: null,
    requestMode: false,
    requesterOrigin: '*',
    requestPending: false,
    requestedPublicKey: '',
    requestedAmount: 0,
    recipientPublicKey: '',
    recipientAmount: 0,
    confirmationSignature: null,
    transactionConfirmed: null,
  };

  setConfirmationSignature(confirmationSignature) {
    this.setState({
      transactionConfirmed: null,
      confirmationSignature,
    });
  }

  setRecipientPublicKey(recipientPublicKey) {
    this.setState({recipientPublicKey});
  }

  setRecipientAmount(recipientAmount) {
    this.setState({recipientAmount});
  }

  dismissMessage(index) {
    const {messages} = this.state;
    messages.splice(index, 1);
    this.setState({messages});
  }

  addError(message) {
    this.addMessage(message, 'danger');
  }

  addWarning(message) {
    this.addMessage(message, 'warning');
  }

  addInfo(message) {
    this.addMessage(message, 'info');
  }

  addMessage(message, type) {
    const {messages} = this.state;
    messages.push([message, type]);
    this.setState({messages});
  }

  async runModal(title, text, f) {
    this.setState({
      busyModal: {title, text},
    });

    try {
      await f();
    } catch (err) {
      console.log(err);
      this.addError(err.message);
    }

    this.setState({busyModal: null});
  }

  onStoreChange = () => {
    this.web3sol = new web3.Connection(this.props.store.networkEntryPoint);
    let account = null;
    if (this.props.store.accountSecretKey) {
      account = new web3.Account(this.props.store.accountSecretKey);
    }
    this.setState({account}, this.refreshBalance);
  };

  onAddFunds(params, origin) {
    if (!params || this.state.requestPending) return;
    if (!params.pubkey || !params.network) {
      if (!params.pubkey) this.addError(`Request did not specify a public key`);
      if (!params.network) this.addError(`Request did not specify a network`);
      return;
    }

    let requestedNetwork;
    try {
      requestedNetwork = new URL(params.network).origin;
    } catch (err) {
      this.addError(`Request network is invalid: "${params.network}"`);
      return;
    }

    const walletNetwork = new URL(this.props.store.networkEntryPoint).origin;
    if (requestedNetwork !== walletNetwork) {
      this.props.store.setNetworkEntryPoint(requestedNetwork);
      this.addWarning(`Changed wallet network from "${walletNetwork}" to "${requestedNetwork}"`);
    }

    this.setState({
      requesterOrigin: origin,
      requestPending: true,
      requestedAmount: `${params.amount || ''}`,
      requestedPublicKey: params.pubkey,
    });
  }

  postWindowMessage(method, params) {
    if (window.opener) {
      window.opener.postMessage({method, params}, this.state.requesterOrigin);
    }
  }

  onWindowOpen() {
    this.setState({requestMode: true});
    window.addEventListener('message', e => {
      if (e.data) {
        switch (e.data.method) {
          case 'addFunds':
            this.onAddFunds(e.data.params, e.origin);
            return true;
        }
      }
    });

    this.postWindowMessage('ready');
  }

  componentDidMount() {
    this.props.store.onChange(this.onStoreChange);
    this.onStoreChange();
    if (window.opener) {
      this.onWindowOpen();
    }
  }

  componentWillUnmount() {
    this.props.store.removeChangeListener(this.onStoreChange);
  }

  copyPublicKey() {
    copy(this.state.account.publicKey);
  }

  refreshBalance() {
    if (this.state.account) {
      this.runModal('Updating Account Balance', 'Please wait...', async () => {
        this.setState({
          balance: await this.web3sol.getBalance(this.state.account.publicKey),
        });
      });
    }
  }

  requestAirdrop() {
    this.runModal('Requesting Airdrop', 'Please wait...', async () => {
      await this.web3sol.requestAirdrop(this.state.account.publicKey, 1000);
      this.setState({
        balance: await this.web3sol.getBalance(this.state.account.publicKey),
      });
    });
  }

  sendTransaction(closeOnSuccess) {
    this.runModal('Sending Transaction', 'Please wait...', async () => {
      const amount = this.state.recipientAmount;
      this.setState({requestedAmount: 0, requestPending: false});
      const transaction = web3.SystemProgram.transfer(
        this.state.account.publicKey,
        new web3.PublicKey(this.state.recipientPublicKey),
        amount,
      );

      let signature = '';
      try {
        signature = await web3.sendAndConfirmTransaction(
          this.web3sol,
          transaction,
          this.state.account,
        );
      } catch (err) {
        // Transaction failed but fees were still taken
        this.setState({
          balance: await this.web3sol.getBalance(this.state.account.publicKey),
        });
        this.postWindowMessage('addFundsResponse', {err: true});
        throw err;
      }

      this.postWindowMessage('addFundsResponse', {signature, amount});
      if (closeOnSuccess) {
        window.close();
      } else {
        this.setState({
          balance: await this.web3sol.getBalance(this.state.account.publicKey),
        });
      }
    });
  }

  confirmTransaction() {
    this.runModal('Confirming Transaction', 'Please wait...', async () => {
      const result = await this.web3sol.confirmTransaction(
        this.state.confirmationSignature,
      );
      this.setState({
        transactionConfirmed: result,
      });
    });
  }

  sendDisabled() {
    return (
      this.state.recipientPublicKey === null ||
      this.state.recipientAmount === null
    );
  }

  render() {
    if (!this.state.account) {
      return <Account store={this.props.store} />;
    }

    const copyTooltip = (
      <Tooltip id="clipboard">Copy public key to clipboard</Tooltip>
    );
    const refreshBalanceTooltip = (
      <Tooltip id="refresh">Refresh account balance</Tooltip>
    );
    const airdropTooltip = <Tooltip id="airdrop">Request an airdrop</Tooltip>;

    const busyModal = this.state.busyModal ? (
      <BusyModal
        show
        title={this.state.busyModal.title}
        text={this.state.busyModal.text}
      />
    ) : null;

    const settingsModal = this.state.settingsModal ? (
      <SettingsModal
        show
        store={this.props.store}
        onHide={() => this.setState({settingsModal: false})}
      />
    ) : null;

    const airdropDisabled = this.state.balance >= 1000;

    return (
      <div>
        <div style={{width: '100%', textAlign: 'right'}}>
          <Button onClick={() => this.setState({settingsModal: true})}>
            <Glyphicon
              style={{backgroundColor: 'white'}}
              glyph="menu-hamburger"
            />
          </Button>
        </div>
        {busyModal}
        {settingsModal}
        <DismissibleMessages
          messages={this.state.messages}
          onDismiss={index => this.dismissMessage(index)}
        />
        <Well>
          <FormGroup>
            <ControlLabel>Account Public Key</ControlLabel>
            <InputGroup>
              <FormControl
                readOnly
                type="text"
                size="21"
                value={this.state.account.publicKey}
              />
              <InputGroup.Button>
                <OverlayTrigger placement="bottom" overlay={copyTooltip}>
                  <Button onClick={() => this.copyPublicKey()}>
                    <Glyphicon glyph="copy" />
                  </Button>
                </OverlayTrigger>
              </InputGroup.Button>
            </InputGroup>
          </FormGroup>
          <p />
          Account Balance: {this.state.balance} &nbsp;
          <OverlayTrigger placement="top" overlay={refreshBalanceTooltip}>
            <Button onClick={() => this.refreshBalance()}>
              <Glyphicon glyph="refresh" />
            </Button>
          </OverlayTrigger>
          <OverlayTrigger placement="bottom" overlay={airdropTooltip}>
            <Button
              className="margin-left"
              disabled={airdropDisabled}
              onClick={() => this.requestAirdrop()}
            >
              <Glyphicon glyph="send" />
            </Button>
          </OverlayTrigger>
        </Well>
        {this.renderPanels()}
      </div>
    );
  }

  renderPanels() {
    if (this.state.requestMode) {
      return this.renderTokenRequestPanel();
    } else {
      return (
        <React.Fragment>
          {this.renderSendTokensPanel()}
          {this.renderConfirmTxPanel()}
        </React.Fragment>
      );
    }
  }

  renderTokenRequestPanel() {
    return (
      <Panel>
        <Panel.Heading>Token Request</Panel.Heading>
        <Panel.Body>
          <PublicKeyInput
            key={this.state.requestedPublicKey}
            defaultValue={this.state.requestedPublicKey || ''}
            onPublicKey={publicKey => this.setRecipientPublicKey(publicKey)}
          />
          <TokenInput
            key={this.state.requestedAmount + this.state.balance}
            maxValue={this.state.balance}
            defaultValue={this.state.requestedAmount || ''}
            onAmount={amount => this.setRecipientAmount(amount)}
          />
          <div className="text-center">
            <Button
              disabled={this.sendDisabled()}
              onClick={() => this.sendTransaction(false)}
            >
              Send
            </Button>
            <Button
              bsStyle="success"
              className="margin-left"
              disabled={this.sendDisabled()}
              onClick={() => this.sendTransaction(true)}
            >
              Send & Close
            </Button>
          </div>
        </Panel.Body>
      </Panel>
    );
  }

  renderSendTokensPanel() {
    return (
      <Panel>
        <Panel.Heading>Send Tokens</Panel.Heading>
        <Panel.Body>
          <PublicKeyInput
            onPublicKey={publicKey => this.setRecipientPublicKey(publicKey)}
          />
          <TokenInput
            key={this.state.balance}
            defaultValue={this.state.recipientAmount}
            maxValue={this.state.balance}
            onAmount={amount => this.setRecipientAmount(amount)}
          />
          <div className="text-center">
            <Button
              disabled={this.sendDisabled()}
              onClick={() => this.sendTransaction(false)}
            >
              Send
            </Button>
          </div>
        </Panel.Body>
      </Panel>
    );
  }

  renderConfirmTxPanel() {
    const confirmDisabled = this.state.confirmationSignature === null;
    return (
      <Panel>
        <Panel.Heading>Confirm Transaction</Panel.Heading>
        <Panel.Body>
          <SignatureInput
            onSignature={signature => this.setConfirmationSignature(signature)}
          />
          <div className="text-center">
            <Button
              disabled={confirmDisabled}
              onClick={() => this.confirmTransaction()}
            >
              Confirm
            </Button>
          </div>
          {typeof this.state.transactionConfirmed === 'boolean' ? (
            <b>
              {this.state.transactionConfirmed ? 'CONFIRMED' : 'NOT CONFIRMED'}
            </b>
          ) : (
            ''
          )}
        </Panel.Body>
      </Panel>
    );
  }
}
Wallet.propTypes = {
  store: PropTypes.object,
};
