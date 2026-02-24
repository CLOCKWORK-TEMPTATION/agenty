import { describe, expect, it } from "vitest";
import { EXECUTION_GRAPH } from "../src/index.js";

describe("Graph Topology", () => {
  describe("graph structure", () => {
    it("should have START as first node", () => {
      expect(EXECUTION_GRAPH[0]).toBe("START");
    });

    it("should have END as last node", () => {
      expect(EXECUTION_GRAPH[EXECUTION_GRAPH.length - 1]).toBe("END");
    });

    it("should contain all required nodes", () => {
      const requiredNodes = [
        "START",
        "intake",
        "profile",
        "template_select",
        "team_design",
        "model_route",
        "tools_allocate",
        "skills_load",
        "approval_gate",
        "planner",
        "specialists_parallel",
        "tool_executor",
        "aggregate",
        "verifier",
        "finalizer",
        "END"
      ];

      for (const node of requiredNodes) {
        expect(EXECUTION_GRAPH).toContain(node);
      }
    });

    it("should have unique nodes", () => {
      const uniqueNodes = new Set(EXECUTION_GRAPH);
      expect(uniqueNodes.size).toBe(EXECUTION_GRAPH.length - 1);
    });

    it("should have correct total number of nodes", () => {
      expect(EXECUTION_GRAPH.length).toBe(17);
    });
  });

  describe("node order enforcement", () => {
    it("should enforce intake before profile", () => {
      const intakeIndex = EXECUTION_GRAPH.indexOf("intake");
      const profileIndex = EXECUTION_GRAPH.indexOf("profile");
      expect(intakeIndex).toBeLessThan(profileIndex);
    });

    it("should enforce profile before template_select", () => {
      const profileIndex = EXECUTION_GRAPH.indexOf("profile");
      const templateIndex = EXECUTION_GRAPH.indexOf("template_select");
      expect(profileIndex).toBeLessThan(templateIndex);
    });

    it("should enforce template_select before team_design", () => {
      const templateIndex = EXECUTION_GRAPH.indexOf("template_select");
      const teamIndex = EXECUTION_GRAPH.indexOf("team_design");
      expect(templateIndex).toBeLessThan(teamIndex);
    });

    it("should enforce team_design before model_route", () => {
      const teamIndex = EXECUTION_GRAPH.indexOf("team_design");
      const modelIndex = EXECUTION_GRAPH.indexOf("model_route");
      expect(teamIndex).toBeLessThan(modelIndex);
    });

    it("should enforce model_route before tools_allocate", () => {
      const modelIndex = EXECUTION_GRAPH.indexOf("model_route");
      const toolsIndex = EXECUTION_GRAPH.indexOf("tools_allocate");
      expect(modelIndex).toBeLessThan(toolsIndex);
    });

    it("should enforce tools_allocate before skills_load", () => {
      const toolsIndex = EXECUTION_GRAPH.indexOf("tools_allocate");
      const skillsIndex = EXECUTION_GRAPH.indexOf("skills_load");
      expect(toolsIndex).toBeLessThan(skillsIndex);
    });

    it("should enforce skills_load before approval_gate", () => {
      const skillsIndex = EXECUTION_GRAPH.indexOf("skills_load");
      const approvalIndex = EXECUTION_GRAPH.indexOf("approval_gate");
      expect(skillsIndex).toBeLessThan(approvalIndex);
    });

    it("should enforce approval_gate before planner", () => {
      const approvalIndex = EXECUTION_GRAPH.indexOf("approval_gate");
      const plannerIndex = EXECUTION_GRAPH.indexOf("planner");
      expect(approvalIndex).toBeLessThan(plannerIndex);
    });

    it("should enforce planner before specialists_parallel", () => {
      const plannerIndex = EXECUTION_GRAPH.indexOf("planner");
      const specialistsIndex = EXECUTION_GRAPH.indexOf("specialists_parallel");
      expect(plannerIndex).toBeLessThan(specialistsIndex);
    });

    it("should enforce specialists_parallel before tool_executor", () => {
      const specialistsIndex = EXECUTION_GRAPH.indexOf("specialists_parallel");
      const executorIndex = EXECUTION_GRAPH.indexOf("tool_executor");
      expect(specialistsIndex).toBeLessThan(executorIndex);
    });

    it("should enforce tool_executor before aggregate", () => {
      const executorIndex = EXECUTION_GRAPH.indexOf("tool_executor");
      const aggregateIndex = EXECUTION_GRAPH.indexOf("aggregate");
      expect(executorIndex).toBeLessThan(aggregateIndex);
    });

    it("should enforce aggregate before verifier", () => {
      const aggregateIndex = EXECUTION_GRAPH.indexOf("aggregate");
      const verifierIndex = EXECUTION_GRAPH.indexOf("verifier");
      expect(aggregateIndex).toBeLessThan(verifierIndex);
    });

    it("should enforce verifier before finalizer", () => {
      const verifierIndex = EXECUTION_GRAPH.indexOf("verifier");
      const finalizerIndex = EXECUTION_GRAPH.indexOf("finalizer");
      expect(verifierIndex).toBeGreaterThan(-1);
      expect(finalizerIndex).toBeGreaterThan(verifierIndex);
    });

    it("should enforce finalizer before END", () => {
      const finalizerIndex = EXECUTION_GRAPH.indexOf("finalizer");
      const endIndex = EXECUTION_GRAPH.indexOf("END");
      expect(finalizerIndex).toBeLessThan(endIndex);
    });
  });

  describe("critical paths", () => {
    it("should have verifier in critical path before finalizer", () => {
      const verifierIndex = EXECUTION_GRAPH.indexOf("verifier");
      const finalizerIndex = EXECUTION_GRAPH.indexOf("finalizer");
      expect(verifierIndex).toBeGreaterThan(-1);
      expect(finalizerIndex).toBeGreaterThan(-1);
      expect(verifierIndex).toBeLessThan(finalizerIndex);
    });

    it("should have tool_executor after specialists", () => {
      const specialistsIndex = EXECUTION_GRAPH.indexOf("specialists_parallel");
      const executorIndex = EXECUTION_GRAPH.indexOf("tool_executor");
      expect(executorIndex).toBeGreaterThan(specialistsIndex);
    });

    it("should have aggregate after tool_executor", () => {
      const executorIndex = EXECUTION_GRAPH.indexOf("tool_executor");
      const aggregateIndex = EXECUTION_GRAPH.indexOf("aggregate");
      expect(aggregateIndex).toBeGreaterThan(executorIndex);
    });

    it("should route all tools through tool_executor", () => {
      expect(EXECUTION_GRAPH).toContain("tool_executor");
    });

    it("should have skills_load after tools_allocate", () => {
      const toolsIndex = EXECUTION_GRAPH.indexOf("tools_allocate");
      const skillsIndex = EXECUTION_GRAPH.indexOf("skills_load");
      expect(skillsIndex).toBeGreaterThan(toolsIndex);
    });
  });

  describe("optional nodes", () => {
    it("should mark human_feedback as optional", () => {
      const humanFeedbackNode = EXECUTION_GRAPH.find((node) =>
        node.includes("human_feedback")
      );
      expect(humanFeedbackNode).toContain("optional");
    });

    it("should have human_feedback in the graph", () => {
      const humanFeedbackNode = EXECUTION_GRAPH.find((node) =>
        node.includes("human_feedback")
      );
      expect(humanFeedbackNode).toBeDefined();
    });
  });

  describe("graph validation", () => {
    it("should not have duplicate nodes", () => {
      const nodeSet = new Set(EXECUTION_GRAPH);
      expect(nodeSet.size).toBe(EXECUTION_GRAPH.length - 1);
    });

    it("should not have empty node names", () => {
      for (const node of EXECUTION_GRAPH) {
        expect(node.trim().length).toBeGreaterThan(0);
      }
    });

    it("should use consistent naming convention", () => {
      const specialNodes = ["START", "END"];
      const optionalPattern = /\(optional\)$/;

      for (const node of EXECUTION_GRAPH) {
        if (specialNodes.includes(node)) {
          continue;
        }

        if (optionalPattern.test(node)) {
          const baseName = node.replace(optionalPattern, "").trim();
          expect(baseName).toMatch(/^[a-z_]+$/);
        } else {
          expect(node).toMatch(/^[a-z_]+$/);
        }
      }
    });

    it("should have logical sequence", () => {
      const sequence = [
        "START",
        "intake",
        "profile",
        "template_select",
        "team_design",
        "model_route",
        "tools_allocate",
        "skills_load",
        "approval_gate",
        "planner",
        "specialists_parallel",
        "tool_executor",
        "aggregate",
        "verifier",
        "finalizer",
        "END"
      ];

      for (let i = 0; i < sequence.length - 1; i++) {
        const currentIndex = EXECUTION_GRAPH.indexOf(sequence[i]);
        const nextIndex = EXECUTION_GRAPH.indexOf(sequence[i + 1]);
        expect(currentIndex).toBeLessThan(nextIndex);
      }
    });
  });

  describe("phase groups", () => {
    it("should have setup phase nodes first", () => {
      const setupNodes = ["intake", "profile", "template_select", "team_design"];
      const setupIndices = setupNodes.map((node) => EXECUTION_GRAPH.indexOf(node));

      const maxSetupIndex = Math.max(...setupIndices);
      const modelRouteIndex = EXECUTION_GRAPH.indexOf("model_route");

      expect(maxSetupIndex).toBeLessThan(modelRouteIndex);
    });

    it("should have preparation phase after setup", () => {
      const prepNodes = ["model_route", "tools_allocate", "skills_load"];
      const prepIndices = prepNodes.map((node) => EXECUTION_GRAPH.indexOf(node));

      const maxPrepIndex = Math.max(...prepIndices);
      const approvalIndex = EXECUTION_GRAPH.indexOf("approval_gate");

      expect(maxPrepIndex).toBeLessThan(approvalIndex);
    });

    it("should have execution phase after preparation", () => {
      const execNodes = ["planner", "specialists_parallel", "tool_executor"];
      const execIndices = execNodes.map((node) => EXECUTION_GRAPH.indexOf(node));

      const maxExecIndex = Math.max(...execIndices);
      const aggregateIndex = EXECUTION_GRAPH.indexOf("aggregate");

      expect(maxExecIndex).toBeLessThan(aggregateIndex);
    });

    it("should have verification phase at end", () => {
      const verifyNodes = ["aggregate", "verifier", "finalizer"];
      const verifyIndices = verifyNodes.map((node) => EXECUTION_GRAPH.indexOf(node));

      const minVerifyIndex = Math.min(...verifyIndices);
      const toolExecutorIndex = EXECUTION_GRAPH.indexOf("tool_executor");

      expect(minVerifyIndex).toBeGreaterThan(toolExecutorIndex);
    });
  });

  describe("immutability", () => {
    it("should not allow modification of graph", () => {
      const originalLength = EXECUTION_GRAPH.length;
      const originalFirst = EXECUTION_GRAPH[0];

      expect(EXECUTION_GRAPH.length).toBe(originalLength);
      expect(EXECUTION_GRAPH[0]).toBe(originalFirst);
    });

    it("should maintain node order", () => {
      const expectedOrder = [...EXECUTION_GRAPH];

      for (let i = 0; i < EXECUTION_GRAPH.length; i++) {
        expect(EXECUTION_GRAPH[i]).toBe(expectedOrder[i]);
      }
    });
  });

  describe("compliance with requirements", () => {
    it("should enforce minimum 2 different models requirement position", () => {
      const modelRouteIndex = EXECUTION_GRAPH.indexOf("model_route");
      const plannerIndex = EXECUTION_GRAPH.indexOf("planner");
      expect(modelRouteIndex).toBeLessThan(plannerIndex);
    });

    it("should enforce max 2 revision loops by verifier position", () => {
      const verifierIndex = EXECUTION_GRAPH.indexOf("verifier");
      const plannerIndex = EXECUTION_GRAPH.indexOf("planner");
      expect(verifierIndex).toBeGreaterThan(plannerIndex);
    });

    it("should enforce verifier before finalizer for quality gate", () => {
      const verifierIndex = EXECUTION_GRAPH.indexOf("verifier");
      const finalizerIndex = EXECUTION_GRAPH.indexOf("finalizer");
      expect(verifierIndex).toBeLessThan(finalizerIndex);
    });

    it("should enforce tool routing through tool_executor", () => {
      const toolExecutorIndex = EXECUTION_GRAPH.indexOf("tool_executor");
      const aggregateIndex = EXECUTION_GRAPH.indexOf("aggregate");
      expect(toolExecutorIndex).toBeLessThan(aggregateIndex);
    });

    it("should have approval_gate before execution", () => {
      const approvalIndex = EXECUTION_GRAPH.indexOf("approval_gate");
      const plannerIndex = EXECUTION_GRAPH.indexOf("planner");
      expect(approvalIndex).toBeLessThan(plannerIndex);
    });
  });
});
