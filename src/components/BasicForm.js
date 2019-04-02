import React, { Component } from 'react';
import { Alert, Form, Row, Col, Input, Button, Select } from 'antd';
const Option = Select.Option;

const FormItem = Form.Item;
const TextArea = Input.TextArea;

class SimpleForm extends Component {
  constructor(props) {
    super(props);
    this.state = {
      visible: true,
      values: {},
      confirmLoading: false,
      inputs: this.props.inputs,
    };
  }

  handleSubmit = e => {
    e.preventDefault();
    this.props.form.validateFields(async (err, data) => {
      console.log(this.state.values);
      console.log("Received values of form: ", {
        ...data,
        ...this.state.values
      });
      if (err) {
        return;
      } else {
        this.setState({ confirmLoading: true });
        await this.props
          .onSave({ ...data, ...this.state.values })
          .then(res => {
            this.handleAlert(res.text, res.status);
          })
          .catch(err => {
            console.log(err);
            this.handleAlert(err.text, err.status);
          });
        this.setState({
          confirmLoading: false,
        })
      }
    });
  };

  handleAlert = (alertText, alertType) => {
    this.setState({
      showAlert: true,
      alertText,
      alertType
    });
  };

  hideAlert = () => {
    this.setState({
      showAlert: false
    });
  };

  handleSelect = (value,e,key) => {
    this.setState({
      values: {
        ...this.state.values,
        [key]: {
          value,
          name: e.props.data.name,
        }
      }
    })
    if (value === 'addNew') {
      this.setState({
        inputs: [...this.state.inputs, { id: `${value}-${e.props.data.name}`, text: e.props.data.name }]
      })
    }
  }

  render() {
    const { getFieldDecorator } = this.props.form;
    let inputs = this.state.inputs.map(i => {
      if (i.type === 'select') {
        const children = i.selectOptions.map(item => (
          <Option key={item.id} value={item.id} data={{ ...item }}>
            <span>
              {item[i.searchKey]}
            </span>
          </Option>))
        return (
          <Col xs={i.span * 3} md={i.span} key={i.id}>
            <FormItem key={i.id} label={i.label} style={{ marginBottom: 12 }}>
              {getFieldDecorator(i.id, {
                rules: [
                  {
                    required: i.required,
                    message: `${i.text} is required.`
                  }
                ]}
              )(
                <Select
                  placeholder={i.text}
                  onChange={(val,e)=>this.handleSelect(val,e,i.id)}
                 >
                 {children}
                </Select>
              )}
            </FormItem>
          </Col>
        );
      } else {
        return (
          <Col xs={i.span * 3} md={i.span} key={i.id}>
            <FormItem key={i.id} label={i.label} style={{marginBottom: 12}}>
              {getFieldDecorator(i.id, {
                rules: [
                  {
                    required: i.required,
                    message: `${i.text} is required`
                  }
                ]
              })(
                i.type === "textarea" ? (
                  <TextArea placeholder={i.text} />
                ) : (
                  <Input placeholder={i.text} type={i.type} />
                )
              )}
            </FormItem>
          </Col>
        );
      }
    });
    return (
      <div>
        <Form>
          {this.state.showAlert && (
            <Alert
              style={{ margin: "-10px 0px 10px 0px" }}
              closable
              afterClose={this.hideAlert}
              message={this.state.alertText}
              type={this.state.alertType}
              showIcon
            />
          )}
          <Row gutter={24}>{inputs}</Row>
          <Button
            onClick={this.handleSubmit}
            size="large"
            type="primary"
            loading={this.state.confirmLoading}
          >
            {this.props.submitText}
          </Button>
        </Form>
      </div>
    );
  }
}

const BasicForm = Form.create()(SimpleForm);
export default BasicForm