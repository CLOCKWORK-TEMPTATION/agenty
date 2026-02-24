/**
 * Hierarchical Orchestration
 * Parent-child teams + delegation
 */

import type {
  HierarchicalTeam,
  DelegationRule,
  SubTaskRequest,
  TeamHierarchyResult,
  TaskRequest,
  TaskProfile
} from "@repo/types";

export interface HierarchicalOrchestratorConfig {
  maxLevels: number;
  maxChildrenPerTeam: number;
  enableDelegation: boolean;
  defaultAggregationStrategy: "parallel" | "sequential" | "voting";
}

export interface SubTaskResult {
  subTaskId: string;
  parentTaskId: string;
  assignedToTeamId: string;
  status: "pending" | "in_progress" | "completed" | "failed";
  result?: Record<string, unknown>;
  error?: string;
  startedAt: Date;
  completedAt?: Date;
}

export interface DelegationDecision {
  shouldDelegate: boolean;
  targetTeamId?: string | undefined;
  reason: string;
  priority: number;
  estimatedComplexity: "low" | "medium" | "high";
}

/**
 * HierarchicalOrchestrator - Manages parent-child team hierarchies
 */
export class HierarchicalOrchestrator {
  private readonly config: HierarchicalOrchestratorConfig;
  private readonly teamHierarchy: Map<string, HierarchicalTeam> = new Map();
  private readonly subTaskResults: Map<string, SubTaskResult> = new Map();

  constructor(config?: Partial<HierarchicalOrchestratorConfig>) {
    this.config = {
      maxLevels: 3,
      maxChildrenPerTeam: 5,
      enableDelegation: true,
      defaultAggregationStrategy: "parallel",
      ...config
    };
  }

  /**
   * Register a team in the hierarchy
   */
  public registerTeam(team: HierarchicalTeam): void {
    if (team.level > this.config.maxLevels) {
      throw new Error(`Team level ${team.level} exceeds maximum ${this.config.maxLevels}`);
    }

    const parent = team.parentTeamId ? this.teamHierarchy.get(team.parentTeamId) : undefined;
    if (team.parentTeamId && !parent) {
      throw new Error(`Parent team ${team.parentTeamId} not found`);
    }

    if (parent && parent.childTeamIds.length >= this.config.maxChildrenPerTeam) {
      throw new Error(`Parent team ${parent.id} has reached max children limit`);
    }

    this.teamHierarchy.set(team.id, team);

    // Update parent's child list
    if (parent) {
      parent.childTeamIds.push(team.id);
    }
  }

  /**
   * Create a parent-child relationship
   */
  public setParentChildRelationship(parentId: string, childId: string): void {
    const parent = this.teamHierarchy.get(parentId);
    const child = this.teamHierarchy.get(childId);

    if (!parent) throw new Error(`Parent team ${parentId} not found`);
    if (!child) throw new Error(`Child team ${childId} not found`);

    if (parent.childTeamIds.length >= this.config.maxChildrenPerTeam) {
      throw new Error(`Parent team ${parentId} has reached max children limit`);
    }

    if (child.parentTeamId) {
      // Remove from old parent
      const oldParent = this.teamHierarchy.get(child.parentTeamId);
      if (oldParent) {
        oldParent.childTeamIds = oldParent.childTeamIds.filter(id => id !== childId);
      }
    }

    child.parentTeamId = parentId;
    child.level = parent.level + 1;
    parent.childTeamIds.push(childId);
  }

  /**
   * Evaluate delegation rules for a task
   */
  public evaluateDelegation(
    task: TaskRequest,
    taskProfile: TaskProfile,
    teamId: string
  ): DelegationDecision {
    if (!this.config.enableDelegation) {
      return { shouldDelegate: false, reason: "Delegation disabled", priority: 0, estimatedComplexity: taskProfile.complexity };
    }

    const team = this.teamHierarchy.get(teamId);
    if (!team) {
      return { shouldDelegate: false, reason: "Team not found in hierarchy", priority: 0, estimatedComplexity: taskProfile.complexity };
    }

    // No children to delegate to
    if (team.childTeamIds.length === 0) {
      return { shouldDelegate: false, reason: "No child teams available", priority: 0, estimatedComplexity: taskProfile.complexity };
    }

    // Check delegation rules
    for (const rule of team.delegationRules.filter(r => r.enabled).sort((a, b) => b.priority - a.priority)) {
      if (this.matchesCondition(task, taskProfile, rule.condition)) {
        return {
          shouldDelegate: true,
          targetTeamId: rule.targetTeamId,
          reason: `Matched rule: ${rule.condition}`,
          priority: rule.priority,
          estimatedComplexity: taskProfile.complexity
        };
      }
    }

    // Default delegation based on complexity
    if (taskProfile.complexity === "high" && team.childTeamIds.length > 0) {
      return {
        shouldDelegate: true,
        targetTeamId: team.childTeamIds[0],
        reason: "High complexity task - delegating to child team",
        priority: 1,
        estimatedComplexity: "high"
      };
    }

    return { shouldDelegate: false, reason: "No matching delegation rules", priority: 0, estimatedComplexity: taskProfile.complexity };
  }

  /**
   * Split a task into sub-tasks for child teams
   */
  public splitTask(
    parentTaskId: string,
    task: TaskRequest,
    taskProfile: TaskProfile,
    teamId: string
  ): SubTaskRequest[] {
    const team = this.teamHierarchy.get(teamId);
    if (!team || team.childTeamIds.length === 0) {
      return [];
    }

    const subTasks: SubTaskRequest[] = [];

    // Split by complexity
    if (taskProfile.complexity === "high") {
      // Create sub-tasks for each child team
      for (const childTeamId of team.childTeamIds) {
        const subTask: TaskRequest = {
          ...task,
          title: `${task.title} (جزء ${subTasks.length + 1})`,
          description: `جزء فرعي من المهمة: ${task.description}`,
          metadata: {
            ...task.metadata,
            parentTaskId,
            isSubTask: true,
            assignedToChild: childTeamId
          }
        };

        subTasks.push({
          parentTaskId,
          subTask,
          assignedToTeamId: childTeamId
        });
      }
    } else {
      // Single delegation
      subTasks.push({
        parentTaskId,
        subTask: {
          ...task,
          metadata: {
            ...task.metadata,
            parentTaskId,
            isSubTask: true
          }
        },
        assignedToTeamId: team.childTeamIds[0]!
      });
    }

    return subTasks;
  }

  /**
   * Execute sub-tasks and aggregate results
   */
  public async executeSubTasks(
    subTasks: SubTaskRequest[],
    aggregationStrategy: "parallel" | "sequential" | "voting" = this.config.defaultAggregationStrategy
  ): Promise<TeamHierarchyResult> {
    const results: SubTaskResult[] = [];

    if (aggregationStrategy === "parallel") {
      // Execute all in parallel
      const promises = subTasks.map(st => this.executeSubTask(st));
      results.push(...await Promise.all(promises));
    } else if (aggregationStrategy === "sequential") {
      // Execute sequentially
      for (const subTask of subTasks) {
        const result = await this.executeSubTask(subTask);
        results.push(result);
        if (result.status === "failed") {
          break; // Stop on first failure
        }
      }
    } else if (aggregationStrategy === "voting") {
      // Execute all and vote on results
      const promises = subTasks.map(st => this.executeSubTask(st));
      results.push(...await Promise.all(promises));
      // Voting logic applied in aggregation
    }

    // Aggregate results
    const aggregated = this.aggregateResults(results, aggregationStrategy);

    return {
      teamId: subTasks[0]?.assignedToTeamId ?? "",
      subTasks,
      aggregatedResults: aggregated
    };
  }

  /**
   * Get team hierarchy path (from root to team)
   */
  public getTeamPath(teamId: string): HierarchicalTeam[] {
    const path: HierarchicalTeam[] = [];
    let current = this.teamHierarchy.get(teamId);

    while (current) {
      path.unshift(current);
      current = current.parentTeamId ? this.teamHierarchy.get(current.parentTeamId) : undefined;
    }

    return path;
  }

  /**
   * Get all descendants of a team
   */
  public getDescendants(teamId: string): HierarchicalTeam[] {
    const team = this.teamHierarchy.get(teamId);
    if (!team) return [];

    const descendants: HierarchicalTeam[] = [];
    const queue = [...team.childTeamIds];

    while (queue.length > 0) {
      const childId = queue.shift()!;
      const child = this.teamHierarchy.get(childId);
      if (child) {
        descendants.push(child);
        queue.push(...child.childTeamIds);
      }
    }

    return descendants;
  }

  /**
   * Add a delegation rule to a team
   */
  public addDelegationRule(teamId: string, rule: DelegationRule): void {
    const team = this.teamHierarchy.get(teamId);
    if (!team) throw new Error(`Team ${teamId} not found`);

    team.delegationRules.push(rule);
  }

  /**
   * Remove a delegation rule
   */
  public removeDelegationRule(teamId: string, ruleId: string): void {
    const team = this.teamHierarchy.get(teamId);
    if (!team) throw new Error(`Team ${teamId} not found`);

    team.delegationRules = team.delegationRules.filter(r => r.id !== ruleId);
  }

  /**
   * Get team statistics
   */
  public getTeamStats(teamId: string): {
    level: number;
    childCount: number;
    descendantCount: number;
    activeDelegationRules: number;
    completedSubTasks: number;
    failedSubTasks: number;
  } {
    const team = this.teamHierarchy.get(teamId);
    if (!team) {
      throw new Error(`Team ${teamId} not found`);
    }

    const descendants = this.getDescendants(teamId);
    const subTaskList = Array.from(this.subTaskResults.values())
      .filter(st => st.assignedToTeamId === teamId || descendants.some(d => d.id === st.assignedToTeamId));

    return {
      level: team.level,
      childCount: team.childTeamIds.length,
      descendantCount: descendants.length,
      activeDelegationRules: team.delegationRules.filter(r => r.enabled).length,
      completedSubTasks: subTaskList.filter(st => st.status === "completed").length,
      failedSubTasks: subTaskList.filter(st => st.status === "failed").length
    };
  }

  // Private methods

  private matchesCondition(task: TaskRequest, taskProfile: TaskProfile, condition: string): boolean {
    // Simple condition matching - can be extended with a proper expression parser
    const conditions = condition.split(" AND ").map(c => c.trim());

    return conditions.every(cond => {
      if (cond.includes("=")) {
        const [key, value] = cond.split("=").map(s => s.trim());
        if (key === "domain") return task.domain === value;
        if (key === "complexity") return taskProfile.complexity === value;
      }
      if (cond === "high_complexity") return taskProfile.complexity === "high";
      if (cond === "medium_complexity") return taskProfile.complexity === "medium";
      if (cond === "low_complexity") return taskProfile.complexity === "low";
      if (cond.startsWith("capability:")) {
        const cap = cond.replace("capability:", "");
        return taskProfile.requiredCapabilities.includes(cap);
      }
      return false;
    });
  }

  private async executeSubTask(subTask: SubTaskRequest): Promise<SubTaskResult> {
    const subTaskId = `subtask-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;

    const result: SubTaskResult = {
      subTaskId,
      parentTaskId: subTask.parentTaskId,
      assignedToTeamId: subTask.assignedToTeamId,
      status: "in_progress",
      startedAt: new Date()
    };

    this.subTaskResults.set(subTaskId, result);

    try {
      // In real implementation, this would call the child team to execute
      // For now, simulate execution
      await this.simulateExecution(subTask);

      result.status = "completed";
      result.result = { message: "Sub-task completed successfully" };
      result.completedAt = new Date();
    } catch (error) {
      result.status = "failed";
      result.error = error instanceof Error ? error.message : String(error);
      result.completedAt = new Date();
    }

    this.subTaskResults.set(subTaskId, result);
    return result;
  }

  private async simulateExecution(_subTask: SubTaskRequest): Promise<void> {
    // Simulate execution time
    const delay = 1000 + Math.random() * 2000;
    await new Promise(resolve => setTimeout(resolve, delay));

    // Random failure for testing (10% chance)
    if (Math.random() < 0.1) {
      throw new Error("Simulated execution failure");
    }
  }

  private aggregateResults(
    results: SubTaskResult[],
    strategy: "parallel" | "sequential" | "voting"
  ): Record<string, unknown> {
    switch (strategy) {
      case "parallel":
        return {
          completedCount: results.filter(r => r.status === "completed").length,
          failedCount: results.filter(r => r.status === "failed").length,
          totalCount: results.length,
          allSuccessful: results.every(r => r.status === "completed"),
          results: results.map(r => r.result)
        };

      case "sequential":
        const firstFailed = results.find(r => r.status === "failed");
        return {
          completedUntil: firstFailed ? results.indexOf(firstFailed) : results.length,
          failed: !!firstFailed,
          failureReason: firstFailed?.error,
          results: results.filter(r => r.status === "completed").map(r => r.result)
        };

      case "voting":
        // Simple voting - count results and pick majority
        const resultVotes = new Map<string, number>();
        for (const r of results) {
          if (r.result) {
            const key = JSON.stringify(r.result);
            resultVotes.set(key, (resultVotes.get(key) || 0) + 1);
          }
        }
        let winner: string | undefined;
        let maxVotes = 0;
        for (const [key, votes] of resultVotes) {
          if (votes > maxVotes) {
            winner = key;
            maxVotes = votes;
          }
        }
        return {
          consensus: maxVotes > results.length / 2,
          winningVotes: maxVotes,
          totalVotes: results.length,
          result: winner ? JSON.parse(winner) : null
        };

      default:
        return { results: results.map(r => r.result) };
    }
  }
}

// Export factory function
export function createHierarchicalOrchestrator(
  config?: Partial<HierarchicalOrchestratorConfig>
): HierarchicalOrchestrator {
  return new HierarchicalOrchestrator(config);
}
