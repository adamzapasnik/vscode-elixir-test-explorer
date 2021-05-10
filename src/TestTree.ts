import { Graph, json } from 'graphlib';
import { TestInfo, TestSuiteInfo } from 'vscode-test-adapter-api';
import { ParseOutput } from './utils/tests_parsers';

export interface Test {
  kind: 'test' | 'suite';
  id: string;
  label: string;
  file: string;
  belongsTo: TestSuite;
  description?: string;
  tooltip?: string;
  line?: number;
  skipped?: boolean;
  debuggable?: boolean;
  errored?: boolean;
  message?: string;
}

export interface TestSuite {
  kind: 'test' | 'suite';
  id: string;
  label: string;
  belongsTo: TestSuite | undefined;
  description?: string;
  tooltip?: string;
  file?: string;
  line?: number;
  debuggable?: boolean;
  errored: boolean;
  message?: string;
}

export interface ExportOptions {
  scope: 'ALL' | 'NODE_ID';
  nodeId?: string;
}

/*
  Tree-based data structure which models all projects, directories and files as a graph.

  Can translate the tree structure to a TestSuiteInfo (Test Explorer type), see export method.
*/
export class TestTree {
  private graph: Graph;
  private readonly root: TestSuite;
  private readonly workspaceName;

  constructor(workspaceName: string) {
    this.graph = new Graph();
    this.workspaceName = workspaceName;
    this.root = {
      id: 'ExUnit_suite_root',
      belongsTo: undefined,
      kind: 'suite',
      label: `ExUnit ${this.workspaceName}`,
      description: `Test suite for ${this.workspaceName}`,
      tooltip: 'Test Suite',
      errored: false,
      file: undefined,
    };
    this.graph.setNode('ExUnit_suite_root', this.root);
  }

  public getNode(nodeId: string): Test | TestSuiteInfo {
    return this.graph.node(nodeId);
  }

  public addTest(test: Test): Test {
    const v = test.belongsTo.id || this.root.id;
    const w = test.id;

    if (!this.graph.hasNode(v)) {
      console.warn(`TestSuite does not exist: adding test ${test.file} to ${v}`);
    }

    this.graph.setNode(w, test);
    this.graph.setEdge(v, w, undefined);

    return this.graph.node(w);
  }

  public addSuite(suite: TestSuite): TestSuite {
    const v = suite.belongsTo?.id || this.root.id;
    const w = suite.id;

    this.graph.setNode(w, suite);

    if (v) {
      if (!this.graph.hasNode(v)) {
        console.warn(`TestSuite does not exist: adding suite ${suite} to ${v}`);
      }

      this.graph.setEdge(v, w, undefined);
    }

    return this.graph.node(w);
  }

  public import(testsMap: Map<string, ParseOutput>) {
    let lastSuite: TestSuite = this.root;

    for (const [_, value] of testsMap) {
      const pathParts = value.relativePath.split('/');

      let runningPath = '';

      for (let i = 0; i < pathParts.length; i++) {
        if (pathParts[i] === 'test') {
          continue;
        }

        let parentNodeId;
        if (i === 0) {
          parentNodeId = this.root.id;
        } else {
          parentNodeId = runningPath;
        }

        const parentNode = this.graph.node(parentNodeId) as TestSuite;
        runningPath += `${pathParts[i]}/`;

        lastSuite = this.addSuite({
          kind: 'suite',
          id: runningPath, // TODO: This may not be unique enough for test suites.
          file: value.absolutePath,
          label: pathParts[i],
          belongsTo: parentNode,
          description: undefined,
          tooltip: undefined,
          line: undefined,
          debuggable: undefined,
          errored: false,
          message: undefined,
        });
      }

      value.tests.forEach((test: TestInfo) => {
        this.addTest({
          kind: 'test',
          id: test.id,
          label: test.label,
          file: test.file!,
          belongsTo: lastSuite!,
          description: test.description,
          tooltip: test.tooltip,
          line: test.line,
        });
      });
    }
  }

  public export(options: ExportOptions = { scope: 'ALL' }): TestSuiteInfo | TestInfo {
    const buildNode = (node: string): TestSuiteInfo | TestInfo => {
      const currentNode = this.graph.node(node);

      if (currentNode.kind === 'test') {
        return buildTest(currentNode.id);
      }

      if (currentNode.kind === 'suite') {
        return buildSuite(currentNode.id);
      }

      throw new Error('Node ${node} could not be found or is invalid.');
    };

    const buildSuite = (nodeId: string): TestSuiteInfo => {
      const currentNode: TestSuite = this.graph.node(nodeId);
      const successors = this.graph.successors(nodeId) as string[];
      const nextNodes = successors?.map(buildNode) || [];

      if (nodeId === this.root.id) {
        return {
          type: 'suite',
          id: this.root.id,
          label: this.root.label,
          description: this.root.description,
          tooltip: this.root.tooltip,
          file: undefined,
          line: undefined,
          debuggable: false,
          children: nextNodes,
          errored: undefined,
          message: '',
        };
      } else {
        return {
          type: 'suite',
          id: currentNode.id,
          label: currentNode.label,
          description: currentNode.description,
          tooltip: currentNode.tooltip,
          file: currentNode.file,
          line: currentNode.line,
          debuggable: currentNode.debuggable,
          children: nextNodes,
          errored: currentNode.errored,
          message: currentNode.message,
        };
      }
    };

    const buildTest = (nodeId: string): TestInfo => {
      const currentNode: Test = this.graph.node(nodeId);

      return {
        type: 'test',
        id: currentNode.id,
        label: currentNode.label,
        description: currentNode.description,
        tooltip: currentNode.tooltip,
        file: currentNode.file,
        line: currentNode.line,
        skipped: currentNode.skipped,
        debuggable: currentNode.debuggable,
        errored: currentNode.errored,
        message: currentNode.message,
      };
    };

    switch (options.scope) {
      case 'ALL': {
        return buildSuite(this.root.id);
      }
      case 'NODE_ID': {
        return buildNode(options.nodeId!);
      }
    }
  }
}
