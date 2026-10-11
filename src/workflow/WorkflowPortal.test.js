import React from 'react';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import WorkflowPortal from './WorkflowPortal';
const mockClient = {auth:{getSession:jest.fn(),onAuthStateChange:jest.fn(),resetPasswordForEmail:jest.fn(),updateUser:jest.fn()}};
jest.mock('../runtimeConfig',()=>({readRuntimeConfig:()=>({workspaceId:'test'})}));
jest.mock('../supabaseRuntimeClient',()=>({getRuntimeSupabaseClient:()=>mockClient}));
jest.mock('./WorkflowPanel',()=>()=> <div>Workflow content</div>);
beforeEach(()=>{jest.clearAllMocks();process.env.REACT_APP_WELCOMEFLOW_WORKFLOW_ENABLED='true';window.location.hash='';mockClient.auth.onAuthStateChange.mockReturnValue({data:{subscription:{unsubscribe:jest.fn()}}});mockClient.auth.getSession.mockResolvedValue({data:{session:{}}});mockClient.auth.updateUser.mockResolvedValue({});mockClient.auth.resetPasswordForEmail.mockResolvedValue({});});
afterEach(()=>{window.location.hash='';});
test('setup email requires an explicit click and uses current workflow origin',async()=>{
  render(<WorkflowPortal/>);expect(mockClient.auth.resetPasswordForEmail).not.toHaveBeenCalled();
  fireEvent.click(screen.getByText('Sign in or change account'));
  fireEvent.change(screen.getByLabelText('Email'),{target:{value:'owner@example.test'}});
  fireEvent.click(screen.getByText('Set or reset password'));
  await waitFor(()=>expect(mockClient.auth.resetPasswordForEmail).toHaveBeenCalledWith('owner@example.test',{redirectTo:`${window.location.origin}/workflow`}));
});
test('invite allows password setup only with an authenticated invite session',async()=>{
  window.location.hash='#type=invite';mockClient.auth.getSession.mockResolvedValue({data:{session:null}});
  render(<WorkflowPortal/>);fireEvent.change(screen.getByLabelText('New password'),{target:{value:'synthetic-test-password'}});fireEvent.click(screen.getByText('Save password'));
  expect(await screen.findByText('Open your WelcomeFlow setup email link first.')).toBeInTheDocument();expect(mockClient.auth.updateUser).not.toHaveBeenCalled();
});
test('verified invite session can set a password without signup or membership changes',async()=>{
  window.location.hash='#type=invite';render(<WorkflowPortal/>);
  fireEvent.change(screen.getByLabelText('New password'),{target:{value:'synthetic-test-password'}});fireEvent.click(screen.getByText('Save password'));
  await waitFor(()=>expect(mockClient.auth.updateUser).toHaveBeenCalledWith({password:'synthetic-test-password'}));
  expect(await screen.findByText('Your WelcomeFlow password is saved.')).toBeInTheDocument();
});
