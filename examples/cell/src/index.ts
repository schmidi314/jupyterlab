// Copyright (c) Jupyter Development Team.
// Distributed under the terms of the Modified BSD License.

import { PageConfig, URLExt } from '@jupyterlab/coreutils';
(window as any).__webpack_public_path__ = URLExt.join(
  PageConfig.getBaseUrl(),
  'example/'
);

import '@jupyterlab/application/style/index.css';
import '@jupyterlab/cells/style/index.css';
import '@jupyterlab/theme-light-extension/style/theme.css';
import '@jupyterlab/completer/style/index.css';
import '../index.css';

import { Toolbar as AppToolbar, SessionContext } from '@jupyterlab/apputils';
import { Toolbar } from '@jupyterlab/ui-components';

import { CodeCell, CodeCellModel } from '@jupyterlab/cells';

import { CodeMirrorMimeTypeService } from '@jupyterlab/codemirror';

import {
  Completer,
  CompleterModel,
  CompletionHandler,
  KernelCompleterProvider,
  ProviderReconciliator
} from '@jupyterlab/completer';

import {
  standardRendererFactories as initialFactories,
  RenderMimeRegistry
} from '@jupyterlab/rendermime';

import {
  KernelManager,
  KernelSpecManager,
  SessionManager
} from '@jupyterlab/services';

import { CommandRegistry } from '@lumino/commands';

import { BoxPanel, Widget } from '@lumino/widgets';

function main(): void {
  const kernelManager = new KernelManager();
  const specsManager = new KernelSpecManager();
  const sessionManager = new SessionManager({ kernelManager });
  const sessionContext = new SessionContext({
    sessionManager,
    specsManager,
    name: 'Example'
  });
  const mimeService = new CodeMirrorMimeTypeService();

  // Initialize the command registry with the bindings.
  const commands = new CommandRegistry();
  const useCapture = true;

  // Setup the keydown listener for the document.
  document.addEventListener(
    'keydown',
    event => {
      commands.processKeydownEvent(event);
    },
    useCapture
  );

  // Create the cell widget with a default rendermime instance.
  const rendermime = new RenderMimeRegistry({ initialFactories });

  const cellWidget = new CodeCell({
    rendermime,
    model: new CodeCellModel()
  }).initializeState();

  // Handle the mimeType for the current kernel asynchronously.
  sessionContext.kernelChanged.connect(() => {
    void sessionContext.session?.kernel?.info.then(info => {
      const lang = info.language_info;
      const mimeType = mimeService.getMimeTypeByLanguage(lang);
      cellWidget.model.mimeType = mimeType;
    });
  });

  // Use the default kernel.
  sessionContext.kernelPreference = { autoStartDefault: true };

  // Set up a completer.
  const editor = cellWidget.editor;
  const model = new CompleterModel();
  const completer = new Completer({ editor, model });
  const timeout = 1000;
  const provider = new KernelCompleterProvider();
  const reconciliator = new ProviderReconciliator({
    context: { widget: cellWidget, editor, session: sessionContext.session },
    providers: [provider],
    timeout: timeout
  });
  const handler = new CompletionHandler({ completer, reconciliator });

  //sessionContext.session?.kernel.
  void sessionContext.ready.then(() => {
    const provider = new KernelCompleterProvider();
    handler.reconciliator = new ProviderReconciliator({
      context: { widget: cellWidget, editor, session: sessionContext.session },
      providers: [provider],
      timeout: timeout
    });
  });

  // Set the handler's editor.
  handler.editor = editor;

  // Hide the widget when it first loads.
  completer.hide();
  completer.addClass('jp-Completer-Cell');

  // Create a toolbar for the cell.
  const toolbar = new Toolbar();
  toolbar.addItem('spacer', Toolbar.createSpacerItem());
  toolbar.addItem(
    'interrupt',
    AppToolbar.createInterruptButton(sessionContext)
  );
  toolbar.addItem('restart', AppToolbar.createRestartButton(sessionContext));
  toolbar.addItem('name', AppToolbar.createKernelNameItem(sessionContext));
  toolbar.addItem('status', AppToolbar.createKernelStatusItem(sessionContext));

  // Lay out the widgets.
  const panel = new BoxPanel();
  panel.id = 'main';
  panel.direction = 'top-to-bottom';
  panel.spacing = 0;
  panel.addWidget(toolbar);
  panel.addWidget(cellWidget);
  BoxPanel.setStretch(toolbar, 0);
  BoxPanel.setStretch(cellWidget, 1);

  // Attach the panel to the DOM.
  Widget.attach(panel, document.body);
  Widget.attach(completer, document.body);

  // Handle widget state.
  window.addEventListener('resize', () => {
    panel.update();
  });
  cellWidget.activate();

  // Add the commands.
  commands.addCommand('invoke:completer', {
    execute: () => {
      handler.invoke();
    }
  });
  commands.addCommand('run:cell', {
    execute: () => CodeCell.execute(cellWidget, sessionContext)
  });

  commands.addKeyBinding({
    selector: '.jp-InputArea-editor.jp-mod-completer-enabled',
    keys: ['Tab'],
    command: 'invoke:completer'
  });
  commands.addKeyBinding({
    selector: '.jp-InputArea-editor',
    keys: ['Shift Enter'],
    command: 'run:cell'
  });

  // Start up the kernel.
  void sessionContext.initialize().then(() => {
    console.debug('Example started!');
  });
}

window.addEventListener('load', main);
