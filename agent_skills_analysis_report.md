# تحليل شامل لمهارات الوكلاء (Agent Skills)

## لتطبيق بناء فرق الوكلاء متعددة النماذج

**تاريخ التحليل:** فبراير 2026  
**المصادر:**

- https://platform.claude.com/docs/en/agents-and-tools/agent-skills/overview
- https://agentskills.io/specification
- https://github.com/anthropics/skills

---

## مقدمة

**Agent Skills** هي قدرات معيارية (modular capabilities) تُوسّع وظائف Claude. كل مهارة تُغلّف تعليمات وبيانات وصفية وموارد اختيارية (سكربتات، قوالب) يستخدمها Claude تلقائياً عند الحاجة.

### الفوائد الرئيسية:

- **التخصيص (Specialize):** تخصيص القدرات للمهام المحددة
- **تقليل التكرار:** إنشاء مرة واحدة، استخدام تلقائي
- **تجميع القدرات:** دمج المهارات لبناء سير عمل معقدة

### هيكل المهارة:

```
skill-name/
├── SKILL.md          # مطلوب - يحتوي على YAML frontmatter + تعليمات
├── scripts/          # اختياري - سكربتات للتنفيذ
├── references/       # اختياري - موارد مرجعية
└── assets/           # اختياري - أصول إضافية
```

---

## 1. المهارات المُنشأة مسبقاً (Pre-built Skills)

### 1.1 PowerPoint (pptx)

**الوصف:** إنشاء وتحرير عروض تقديمية احترافية

**الفائدة:**

- إنشاء شرائح بأنماط متنوعة
- إضافة رسوم بيانية وجداول
- تنسيق النصوص والصور
- دعم قوالب جاهزة

**التكامل مع القوالب:**
| القالب | الاستخدام |
|--------|-----------|
| Research | عرض نتائج البحث |
| Content | عرض المحتوى التسويقي |
| Data Analysis | عرض البيانات والرسوم البيانية |

**SKILL.md المقترح:**

```yaml
---
name: pptx-creation
description: Create and edit PowerPoint presentations with professional layouts, charts, tables, and multimedia content. Use for research presentations, content showcases, and data visualization.
license: Apache-2.0
metadata:
  author: multi-agent-team
  version: "1.0"
  category: document-creation
allowed-tools: Bash Read Write Edit
---

# PowerPoint Creation Skill

## Capabilities
- Create presentations from scratch or templates
- Add and format slides with various layouts
- Insert charts, tables, images, and multimedia
- Apply consistent branding and styling
- Export to various formats

## Best Practices
- Use consistent color schemes
- Keep text concise (6x6 rule)
- Include visual elements for data
- Ensure accessibility compliance

## Workflows
1. **Research Presentation**: Title → Overview → Methodology → Findings → Conclusion
2. **Content Showcase**: Hook → Problem → Solution → Benefits → CTA
3. **Data Report**: Summary → Key Metrics → Trends → Insights → Recommendations
```

**الأدوار المستهدفة:** Content Agent, Finalizer  
**الأولوية:** عالية

---

### 1.2 Excel (xlsx)

**الوصف:** إنشاء وتحليل جداول البيانات

**الفائدة:**

- إنشاء جداول بيانات منظمة
- تطبيق الصيغ والدوال
- إنشاء الرسوم البيانية
- تحليل البيانات الإحصائية

**التكامل مع القوالب:**
| القالب | الاستخدام |
|--------|-----------|
| Data Analysis | تحليل البيانات وإنشاء التقارير |
| Research | تنظيم بيانات البحث |
| Coding | تتبع الأخطاء والاختبارات |

**SKILL.md المقترح:**

```yaml
---
name: xlsx-analysis
description: Create, analyze, and visualize spreadsheet data. Use for data analysis, financial modeling, research data organization, and statistical calculations.
license: Apache-2.0
metadata:
  author: multi-agent-team
  version: "1.0"
  category: data-analysis
allowed-tools: Bash Read Write Edit
---

# Excel/Spreadsheet Skill

## Capabilities
- Create structured spreadsheets
- Apply formulas and functions
- Generate charts and visualizations
- Perform statistical analysis
- Data validation and cleaning

## Best Practices
- Use clear headers
- Apply consistent formatting
- Document complex formulas
- Validate data inputs
- Use named ranges for clarity

## Workflows
1. **Data Analysis**: Import → Clean → Analyze → Visualize → Report
2. **Financial Model**: Inputs → Calculations → Outputs → Sensitivity
3. **Research Data**: Collection → Organization → Analysis → Export
```

**الأدوار المستهدفة:** Data Analysis Agent, Research Agent  
**الأولوية:** عالية

---

### 1.3 Word (docx)

**الوصف:** إنشاء وتحرير المستندات النصية

**الفائدة:**

- كتابة تقارير احترافية
- تنسيق المستندات
- إضافة جداول وصور
- إنشاء فهارس ومراجع

**التكامل مع القوالب:**
| القالب | الاستخدام |
|--------|-----------|
| Research | كتابة تقارير البحث |
| Content | كتابة المقالات والمدونات |
| All | توثيق النتائج النهائية |

**SKILL.md المقترح:**

```yaml
---
name: docx-creation
description: Create and edit Word documents with professional formatting, tables, images, and citations. Use for reports, articles, documentation, and formal communications.
license: Apache-2.0
metadata:
  author: multi-agent-team
  version: "1.0"
  category: document-creation
allowed-tools: Bash Read Write Edit
---

# Word Document Skill

## Capabilities
- Create structured documents
- Apply professional formatting
- Insert tables, images, and charts
- Manage citations and references
- Generate table of contents

## Best Practices
- Use styles consistently
- Apply heading hierarchy
- Include page numbers
- Add headers and footers
- Ensure proper margins

## Workflows
1. **Research Report**: Title → Abstract → Introduction → Method → Results → Discussion → Conclusion → References
2. **Content Article**: Headline → Introduction → Body → Conclusion → CTA
3. **Documentation**: Overview → Setup → Usage → Examples → Troubleshooting
```

**الأدوار المستهدفة:** Content Agent, Research Agent, Finalizer  
**الأولوية:** عالية

---

### 1.4 PDF (pdf)

**الوصف:** إنشاء ومعالجة مستندات PDF

**الفائدة:**

- إنشاء PDF احترافية
- استخراج النصوص والجداول
- دمج وتقسيم ملفات PDF
- ملء النماذج

**التكامل مع القوالب:**
| القالب | الاستخدام |
|--------|-----------|
| All | إنشاء نسخ نهائية قابلة للمشاركة |
| Research | استخراج بيانات من مصادر PDF |
| Data Analysis | معالجة تقارير PDF |

**SKILL.md المقترح:**

```yaml
---
name: pdf-processing
description: Generate PDF documents and extract content from existing PDFs. Use for final document delivery, form processing, and content extraction from research sources.
license: Apache-2.0
metadata:
  author: multi-agent-team
  version: "1.0"
  category: document-processing
allowed-tools: Bash Read Write Edit
---

# PDF Processing Skill

## Capabilities
- Generate PDFs from various formats
- Extract text and tables from PDFs
- Merge and split PDF documents
- Fill PDF forms
- Add annotations and bookmarks

## Best Practices
- Ensure accessibility (PDF/UA)
- Optimize file size
- Include metadata
- Use proper fonts
- Test on multiple viewers

## Workflows
1. **Document Generation**: Source → Format → Generate → Validate → Deliver
2. **Content Extraction**: PDF → Parse → Extract → Structure → Export
3. **Form Processing**: Template → Fill → Validate → Sign → Submit
```

**الأدوار المستهدفة:** All Agents (for finalization), Research Agent  
**الأولوية:** عالية

---

## 2. مهارات مخصصة لقالب Research

### 2.1 مهارة البحث المتقدم (advanced-research)

**الوصف:** إجراء بحث شامل عبر مصادر متعددة

**SKILL.md المقترح:**

```yaml
---
name: advanced-research
description: Conduct comprehensive research across multiple sources including web, academic databases, and internal documents. Synthesize findings into structured insights.
license: Apache-2.0
metadata:
  author: multi-agent-team
  version: "1.0"
  category: research
allowed-tools: WebSearch WebFetch Read
---

# Advanced Research Skill

## Capabilities
- Search across multiple sources
- Evaluate source credibility
- Synthesize information
- Identify knowledge gaps
- Track research progress

## Research Methodology
1. **Define Scope**: Clarify research question and boundaries
2. **Source Identification**: Determine credible sources
3. **Information Gathering**: Collect relevant data
4. **Synthesis**: Combine findings into coherent insights
5. **Validation**: Verify accuracy and completeness

## Source Evaluation Criteria
- Authority: Who created this?
- Accuracy: Is it factually correct?
- Objectivity: Is there bias?
- Currency: When was it published?
- Coverage: Does it address the topic fully?

## Output Format
```

Research Summary:

- Key Findings: [bullet points]
- Sources: [list with credibility ratings]
- Gaps Identified: [areas needing more research]
- Recommendations: [next steps]

```

## Best Practices
- Cross-reference multiple sources
- Note uncertainty levels
- Distinguish facts from opinions
- Document search queries
- Maintain source bibliography
```

**الأدوار المستهدفة:** Research Agent, Planner  
**الأولوية:** عالية

---

### 2.2 مهارة تحليل المصادر (source-analysis)

**الوصف:** تقييم وتحليل مصداقية المصادر

**SKILL.md المقترح:**

```yaml
---
name: source-analysis
description: Analyze and evaluate the credibility, bias, and reliability of information sources. Provide source quality ratings and recommendations.
license: Apache-2.0
metadata:
  author: multi-agent-team
  version: "1.0"
  category: research
allowed-tools: WebFetch Read
---

# Source Analysis Skill

## Capabilities
- Evaluate source credibility
- Detect bias and perspective
- Assess publication quality
- Verify author credentials
- Check citation patterns

## Evaluation Framework: CRAAP Test
- **C**urrency: When was it published? Updated?
- **R**elevance: Does it relate to your topic?
- **A**uthority: Who is the author/publisher?
- **A**ccuracy: Is it supported by evidence?
- **P**urpose: Why was it created?

## Rating Scale
- ⭐⭐⭐⭐⭐: Highly credible, peer-reviewed
- ⭐⭐⭐⭐: Credible, established source
- ⭐⭐⭐: Moderate, verify with other sources
- ⭐⭐: Questionable, use with caution
- ⭐: Unreliable, avoid or flag

## Output Template
```

Source Evaluation:
URL/Title: [source]
Credibility Rating: [1-5 stars]
Bias Assessment: [neutral/left/right/specific]
Key Strengths: [list]
Limitations: [list]
Recommended Use: [how to use this source]

```

## Red Flags
- No author information
- Excessive advertising
- Emotional language
- Lack of citations
- Outdated information
```

**الأدوار المستهدفة:** Research Agent, Verifier  
**الأولوية:** عالية

---

### 2.3 مهارة تلخيص المحتوى (content-summarization)

**الوصف:** تلخيص المحتوى الطويل إلى نقاط رئيسية

**SKILL.md المقترح:**

```yaml
---
name: content-summarization
description: Summarize long-form content into concise, actionable key points while preserving essential information and context.
license: Apache-2.0
metadata:
  author: multi-agent-team
  version: "1.0"
  category: research
allowed-tools: Read
---

# Content Summarization Skill

## Capabilities
- Extract key points from long documents
- Create executive summaries
- Generate abstracts
- Condense multiple sources
- Maintain context and nuance

## Summarization Levels
1. **Executive Summary**: 10% of original length, key decisions only
2. **Brief Summary**: 25% of original, main arguments
3. **Detailed Summary**: 50% of original, comprehensive coverage

## Techniques
- **Extractive**: Pull key sentences verbatim
- **Abstractive**: Rewrite in own words
- **Hybrid**: Combine both approaches

## Summary Structure
```

Title: [document title]
Source: [author/publication]
Length: [original vs summary]

Key Points:

1. [main point]
2. [main point]
3. [main point]

Context: [background information]
Implications: [why this matters]
Action Items: [if applicable]

```

## Best Practices
- Preserve original meaning
- Include supporting evidence
- Note uncertainty or speculation
- Maintain author intent
- Flag important quotes
```

**الأدوار المستهدفة:** Research Agent, Content Agent  
**الأولوية:** متوسطة

---

### 2.4 مهارة الاستشهاد بالمصادر (citation-management)

**الوصف:** إدارة الاستشهادات والمراجع بصيغ مختلفة

**SKILL.md المقترح:**

```yaml
---
name: citation-management
description: Generate and manage citations in various formats (APA, MLA, Chicago, IEEE). Create bibliographies and reference lists.
license: Apache-2.0
metadata:
  author: multi-agent-team
  version: "1.0"
  category: research
allowed-tools: Read Write
---

# Citation Management Skill

## Capabilities
- Generate citations in multiple formats
- Create formatted bibliographies
- Convert between citation styles
- Track in-text citations
- Validate citation completeness

## Supported Formats
- **APA**: Psychology, Education, Social Sciences
- **MLA**: Humanities, Literature, Arts
- **Chicago**: History, Publishing
- **IEEE**: Engineering, Computer Science
- **Harvard**: Business, Economics

## Citation Components
For each source, capture:
- Author(s)
- Publication date
- Title
- Source (journal/website/book)
- URL or DOI
- Access date (for web sources)

## Output Format
```

Bibliography [APA Style]:
[formatted citations alphabetized]

In-Text Citations:

- (Author, Year) for paraphrases
- (Author, Year, p. X) for quotes

```

## Best Practices
- Be consistent within document
- Include all required elements
- Verify URL accessibility
- Update access dates
- Check for proper formatting
```

**الأدوار المستهدفة:** Research Agent, Finalizer  
**الأولوية:** متوسطة

---

## 3. مهارات مخصصة لقالب Coding

### 3.1 مهارة كتابة الكود (code-generation)

**الوصف:** كتابة كود عالي الجودة بلغات برمجة متعددة

**SKILL.md المقترح:**

````yaml
---
name: code-generation
description: Generate high-quality code in multiple programming languages following best practices, design patterns, and language-specific conventions.
license: Apache-2.0
metadata:
  author: multi-agent-team
  version: "1.0"
  category: coding
allowed-tools: Bash Read Write Edit
---

# Code Generation Skill

## Capabilities
- Write code in multiple languages
- Follow language conventions
- Implement design patterns
- Generate documentation
- Create reusable components

## Supported Languages
- Python, JavaScript/TypeScript
- Java, C++, C#
- Go, Rust
- SQL, HTML/CSS
- Shell scripting

## Code Quality Standards
- **Readability**: Clear naming, consistent style
- **Maintainability**: Modular design, DRY principle
- **Performance**: Efficient algorithms
- **Security**: Input validation, safe practices
- **Testability**: Easy to test components

## Output Structure
```python
"""
Module: [name]
Purpose: [what it does]
Author: [agent/system]
Date: [timestamp]
"""

# Imports (grouped: stdlib, third-party, local)

# Constants

# Classes/Functions

# Main execution (if applicable)
````

## Best Practices

- Write self-documenting code
- Include docstrings/comments
- Handle errors gracefully
- Validate inputs
- Follow PEP 8 / language standards

````

**الأدوار المستهدفة:** Coding Agent, Specialist Agents
**الأولوية:** عالية

---

### 3.2 مهارة مراجعة الكود (code-review)

**الوصف:** مراجعة الكود للجودة والأمان والأداء

**SKILL.md المقترح:**
```yaml
---
name: code-review
description: Review code for quality, security, performance, and adherence to best practices. Provide actionable feedback and improvement suggestions.
license: Apache-2.0
metadata:
  author: multi-agent-team
  version: "1.0"
  category: coding
allowed-tools: Read
---

# Code Review Skill

## Capabilities
- Evaluate code quality
- Identify security issues
- Assess performance
- Check style compliance
- Suggest improvements

## Review Checklist

### Functionality
- [ ] Code works as intended
- [ ] Edge cases handled
- [ ] Error handling present
- [ ] Input validation

### Quality
- [ ] Clear naming conventions
- [ ] Appropriate comments
- [ ] No code duplication
- [ ] Single responsibility

### Security
- [ ] No injection vulnerabilities
- [ ] Secrets not hardcoded
- [ ] Proper authentication
- [ ] Input sanitization

### Performance
- [ ] Efficient algorithms
- [ ] No unnecessary operations
- [ ] Resource management
- [ ] Caching where appropriate

## Review Format
````

Code Review: [file/module]

Summary: [overall assessment]

Issues Found:

- [Severity] Line X: [issue] → [suggestion]

Positive Aspects:

- [what's done well]

Recommendations:

- [actionable improvements]

Approval Status: [Approved/Changes Requested]

```

## Severity Levels
- **Critical**: Security vulnerability, data loss risk
- **High**: Functional issue, major bug
- **Medium**: Code quality, maintainability
- **Low**: Style, minor optimization
- **Info**: Suggestion, observation
```

**الأدوار المستهدفة:** Verifier, Senior Coding Agent  
**الأولوية:** عالية

---

### 3.3 مهارة إصلاح الأخطاء (debugging)

**الوصف:** تشخيص وإصلاح أخطاء الكود

**SKILL.md المقترح:**

```yaml
---
name: debugging
description: Diagnose and fix code errors through systematic analysis, reproduction, and resolution. Handle syntax errors, logic errors, and runtime exceptions.
license: Apache-2.0
metadata:
  author: multi-agent-team
  version: "1.0"
  category: coding
allowed-tools: Bash Read Edit
---

# Debugging Skill

## Capabilities
- Analyze error messages
- Reproduce issues
- Identify root causes
- Implement fixes
- Verify solutions

## Debugging Process
1. **Understand**: Read error message, understand expected vs actual
2. **Reproduce**: Create minimal test case
3. **Isolate**: Narrow down cause location
4. **Analyze**: Determine root cause
5. **Fix**: Implement solution
6. **Verify**: Confirm fix works
7. **Prevent**: Add tests, prevent recurrence

## Common Error Types
- **Syntax**: Missing brackets, typos
- **Logic**: Wrong algorithm, off-by-one
- **Runtime**: Null references, type errors
- **Performance**: Infinite loops, memory leaks
- **Integration**: API mismatches, data format issues

## Debug Report Format
```

Bug Report: [brief description]

Error Message:
[exact error text]

Location: [file:line]

Root Cause: [explanation]

Fix Applied:
[code change]

Verification:

- [ ] Error no longer occurs
- [ ] Related functionality works
- [ ] Edge cases tested

Prevention:

- [test added/monitor configured]

```

## Debugging Techniques
- Print/logging statements
- Binary search (comment out half)
- Rubber duck debugging
- Check assumptions
- Simplify and isolate
```

**الأدوار المستهدفة:** Coding Agent, Specialist Agents  
**الأولوية:** عالية

---

### 3.4 مهارة كتابة الاختبارات (test-generation)

**الوصف:** إنشاء اختبارات شاملة للكود

**SKILL.md المقترح:**

````yaml
---
name: test-generation
description: Create comprehensive test suites including unit tests, integration tests, and edge case coverage. Follow testing best practices and frameworks.
license: Apache-2.0
metadata:
  author: multi-agent-team
  version: "1.0"
  category: coding
allowed-tools: Bash Read Write
---

# Test Generation Skill

## Capabilities
- Write unit tests
- Create integration tests
- Design edge case tests
- Generate test data
- Measure code coverage

## Test Types
- **Unit**: Test individual functions/components
- **Integration**: Test component interactions
- **E2E**: Test complete workflows
- **Performance**: Test under load
- **Security**: Test for vulnerabilities

## Test Structure (AAA Pattern)
```python
def test_feature():
    # Arrange: Set up test data
    input_data = ...
    expected = ...

    # Act: Execute code under test
    result = function_under_test(input_data)

    # Assert: Verify results
    assert result == expected
````

## Coverage Goals

- **Lines**: 80%+ coverage
- **Branches**: Cover all if/else paths
- **Functions**: All public functions tested
- **Edge Cases**: Null, empty, extreme values

## Test Report Format

```
Test Suite: [module name]

Coverage:
- Lines: X%
- Branches: X%
- Functions: X/X

Test Cases:
✓ test_normal_case
✓ test_edge_case_null
✓ test_edge_case_empty
✗ test_error_handling (fix needed)

Recommendations:
- [areas needing more coverage]
```

## Best Practices

- Tests should be independent
- One assertion per test (ideally)
- Descriptive test names
- Use fixtures for common setup
- Mock external dependencies

````

**الأدوار المستهدفة:** Coding Agent, Verifier
**الأولوية:** عالية

---

## 4. مهارات مخصصة لقالب Content

### 4.1 مهارة كتابة المحتوى (content-writing)

**الوصف:** كتابة محتوى احترافي لأغراض متنوعة

**SKILL.md المقترح:**
```yaml
---
name: content-writing
description: Create professional content for various purposes including marketing, technical documentation, blog posts, and social media.
license: Apache-2.0
metadata:
  author: multi-agent-team
  version: "1.0"
  category: content
allowed-tools: Read Write
---

# Content Writing Skill

## Capabilities
- Write for different audiences
- Adapt tone and style
- Create engaging headlines
- Structure content effectively
- Optimize for readability

## Content Types
- **Marketing**: Ads, landing pages, emails
- **Technical**: Documentation, guides, API refs
- **Blog**: Articles, thought leadership
- **Social**: Posts, threads, captions
- **Academic**: Papers, reports, proposals

## Writing Framework: AIDA
- **Attention**: Hook the reader
- **Interest**: Build curiosity
- **Desire**: Create want/need
- **Action**: Prompt next step

## Content Structure
````

Headline: [attention-grabbing]

Introduction: [hook + context]

Body:

- Point 1: [supporting argument]
- Point 2: [supporting argument]
- Point 3: [supporting argument]

Conclusion: [summary + CTA]

```

## Tone Guidelines
- **Professional**: Formal, authoritative
- **Conversational**: Friendly, approachable
- **Technical**: Precise, detailed
- **Persuasive**: Compelling, benefit-focused
- **Educational**: Clear, instructional

## Best Practices
- Know your audience
- Use active voice
- Keep sentences concise
- Include examples
- End with clear CTA
```

**الأدوار المستهدفة:** Content Agent, Specialist Agents  
**الأولوية:** عالية

---

### 4.2 مهارة تحسين المحتوى (content-optimization)

**الوصف:** تحسين المحتوى للوضوح والتأثير

**SKILL.md المقترح:**

```yaml
---
name: content-optimization
description: Optimize content for clarity, impact, SEO, and engagement. Improve readability, structure, and effectiveness of existing content.
license: Apache-2.0
metadata:
  author: multi-agent-team
  version: "1.0"
  category: content
allowed-tools: Read Write Edit
---
# Content Optimization Skill

## Capabilities
- Improve readability scores
- Enhance clarity and flow
- Optimize for SEO
- Strengthen CTAs
- Refine messaging

## Optimization Areas

### Readability
- Sentence length (aim for <20 words)
- Paragraph length (3-4 sentences max)
- Vocabulary level (match audience)
- Transition words
- Active voice

### SEO
- Keyword placement
- Meta descriptions
- Header structure (H1, H2, H3)
- Internal/external links
- Image alt text

### Engagement
- Compelling headlines
- Strong opening
- Clear value proposition
- Relevant examples
- Effective CTAs
## Optimization Report
```

Content Analysis: [title]

Readability Score: [Flesch-Kincaid grade]
SEO Score: [0-100]

Improvements Made:

- [change] → [reason]

Before/After:
Before: [original text]
After: [optimized text]

Recommendations:

- [additional improvements]

```

## Best Practices
- Maintain original intent
- Preserve brand voice
- Test with target audience
- A/B test headlines
- Monitor engagement metrics
```

**الأدوار المستهدفة:** Content Agent, Verifier  
**الأولوية:** متوسطة

---

### 4.3 مهارة التدقيق اللغوي (proofreading)

**الوصف:** مراجعة النصوص للأخطاء اللغوية والنحوية

**SKILL.md المقترح:**

```yaml
---
name: proofreading
description: Review text for grammar, spelling, punctuation, and style errors. Ensure linguistic accuracy and consistency.
license: Apache-2.0
metadata:
  author: multi-agent-team
  version: "1.0"
  category: content
allowed-tools: Read Edit
---

# Proofreading Skill

## Capabilities
- Check grammar and syntax
- Fix spelling errors
- Correct punctuation
- Ensure consistency
- Verify style guide compliance

## Checklist

### Grammar
- [ ] Subject-verb agreement
- [ ] Tense consistency
- [ ] Pronoun clarity
- [ ] Article usage (a/an/the)
- [ ] Preposition usage

### Spelling
- [ ] No typos
- [ ] Consistent spelling (US/UK)
- [ ] Proper nouns correct
- [ ] Technical terms accurate

### Punctuation
- [ ] Commas in correct places
- [ ] Periods at sentence ends
- [ ] Apostrophes for possession
- [ ] Quotation marks balanced
- [ ] Colons/semicolons correct

### Style
- [ ] Consistent formatting
- [ ] Numbers formatted consistently
- [ ] Capitalization correct
- [ ] Abbreviations defined

## Proofreading Report
```

Document: [title]

Issues Found: [count]

Corrections:

- Line X: [error] → [correction]

Style Notes:

- [consistency issues]

Overall Quality: [Excellent/Good/Needs Work]

```

## Best Practices
- Read aloud
- Check one issue type at a time
- Take breaks between passes
- Use spell-check as first pass
- Verify facts and names
```

**الأدوار المستهدفة:** Verifier, Finalizer  
**الأولوية:** متوسطة

---

## 5. مهارات مخصصة لقالب Data Analysis

### 5.1 مهارة تحليل البيانات (data-analysis)

**الوصف:** تحليل البيانات واستخراج الأنماط والرؤى

**SKILL.md المقترح:**

```yaml
---
name: data-analysis
description: Analyze datasets to identify patterns, trends, and insights. Apply statistical methods and data science techniques.
license: Apache-2.0
metadata:
  author: multi-agent-team
  version: "1.0"
  category: data-analysis
allowed-tools: Bash Read Write Edit
---

# Data Analysis Skill

## Capabilities
- Explore and profile data
- Apply statistical analysis
- Identify patterns and trends
- Generate insights
- Create visualizations

## Analysis Process
1. **Understand**: Define questions and objectives
2. **Collect**: Gather relevant data
3. **Clean**: Handle missing values, outliers
4. **Explore**: Profile data, find patterns
5. **Analyze**: Apply statistical methods
6. **Visualize**: Create charts and graphs
7. **Interpret**: Draw conclusions
8. **Communicate**: Present findings

## Statistical Methods
- **Descriptive**: Mean, median, mode, std dev
- **Diagnostic**: Correlation, regression
- **Predictive**: Forecasting, classification
- **Prescriptive**: Optimization, simulation

## Analysis Report Format
```

Data Analysis Report: [title]

Dataset Overview:

- Size: [rows x columns]
- Time Period: [range]
- Key Variables: [list]

Key Findings:

1. [finding with evidence]
2. [finding with evidence]
3. [finding with evidence]

Insights:

- [what the data reveals]

Recommendations:

- [actionable next steps]

Visualizations: [list of charts created]

```

## Best Practices
- Document assumptions
- Handle missing data appropriately
- Check for outliers
- Validate results
- Consider causation vs correlation
```

**الأدوار المستهدفة:** Data Analysis Agent, Specialist Agents  
**الأولوية:** عالية

---

### 5.2 مهارة إنشاء الرسوم البيانية (data-visualization)

**الوصف:** إنشاء رسوم بيانية واضحة وجذابة

**SKILL.md المقترح:**

```yaml
---
name: data-visualization
description: Create clear, effective, and aesthetically pleasing data visualizations including charts, graphs, and dashboards.
license: Apache-2.0
metadata:
  author: multi-agent-team
  version: "1.0"
  category: data-analysis
allowed-tools: Bash Read Write
---

# Data Visualization Skill

## Capabilities
- Choose appropriate chart types
- Design effective visualizations
- Create interactive dashboards
- Ensure accessibility
- Export in various formats

## Chart Selection Guide

### Comparisons
- **Bar Chart**: Categories comparison
- **Column Chart**: Time series comparison
- **Radar Chart**: Multi-variable comparison

### Distributions
- **Histogram**: Data distribution
- **Box Plot**: Statistical summary
- **Violin Plot**: Distribution shape

### Relationships
- **Scatter Plot**: Correlation
- **Bubble Chart**: Three variables
- **Heat Map**: Matrix relationships

### Compositions
- **Pie Chart**: Part-to-whole (use sparingly)
- **Stacked Bar**: Category breakdown
- **Treemap**: Hierarchical data

### Trends
- **Line Chart**: Time series
- **Area Chart**: Cumulative trends
- **Sparkline**: Inline trends

## Design Principles
- **Clear Title**: Describe the insight
- **Labeled Axes**: Include units
- **Legend**: If multiple series
- **Color**: Purposeful, accessible
- **Annotations**: Highlight key points

## Visualization Checklist
- [ ] Chart type appropriate for data
- [ ] Title descriptive
- [ ] Axes labeled
- [ ] Colors accessible (colorblind-friendly)
- [ ] Data-ink ratio optimized
- [ ] Source cited

## Best Practices
- Start axes at zero (for bar charts)
- Limit categories (max 7±2)
- Use consistent colors
- Provide context
- Test with audience
```

**الأدوار المستهدفة:** Data Analysis Agent, Content Agent  
**الأولوية:** عالية

---

### 5.3 مهارة استخراج الرؤى (insight-extraction)

**الوصف:** تحويل البيانات إلى رؤى قابلة للتنفيذ

**SKILL.md المقترح:**

```yaml
---
name: insight-extraction
description: Transform raw data and analysis results into actionable insights and strategic recommendations.
license: Apache-2.0
metadata:
  author: multi-agent-team
  version: "1.0"
  category: data-analysis
allowed-tools: Read Write
---

# Insight Extraction Skill

## Capabilities
- Identify meaningful patterns
- Connect data to business context
- Generate actionable recommendations
- Prioritize insights by impact
- Communicate findings clearly

## Insight Framework: SOAR
- **S**ee: What does the data show?
- **O**bserve: What patterns emerge?
- **A**nalyze: Why is this happening?
- **R**ecommend: What should we do?

## Insight Categories
1. **Descriptive**: What happened?
2. **Diagnostic**: Why did it happen?
3. **Predictive**: What will happen?
4. **Prescriptive**: What should we do?

## Insight Quality Criteria
- **Novel**: Not obvious
- **Actionable**: Can act on it
- **Relevant**: Addresses objectives
- **Evidence-based**: Supported by data
- **Timely**: Current and applicable

## Insight Report Format
```

Key Insights: [title]

Insight 1: [headline]

- Evidence: [supporting data]
- Context: [why it matters]
- Action: [recommended step]
- Impact: [expected outcome]
- Priority: [High/Medium/Low]

[Repeat for each insight]

Summary Dashboard:

- Top Priority Actions: [list]
- Quick Wins: [list]
- Strategic Opportunities: [list]

```

## Best Practices
- Focus on "so what?"
- Quantify impact when possible
- Consider multiple perspectives
- Acknowledge limitations
- Prioritize by feasibility and impact
```

**الأدوار المستهدفة:** Data Analysis Agent, Finalizer  
**الأولوية:** عالية

---

## 6. مهارات للأدوار الأساسية

### 6.1 مهارة Orchestrator

**الوصف:** تنسيق وتوجيه فريق الوكلاء

**SKILL.md المقترح:**

```yaml
---
name: orchestrator-core
description: Coordinate and direct multi-agent teams, manage task delegation, monitor progress, and ensure successful completion of complex workflows.
license: Apache-2.0
metadata:
  author: multi-agent-team
  version: "1.0"
  category: orchestration
allowed-tools: Bash Read Write
---

# Orchestrator Core Skill

## Role
The Orchestrator is the central coordinator for multi-agent teams. It breaks down complex tasks, delegates to appropriate agents, and synthesizes results.

## Responsibilities
- Task decomposition
- Agent selection and delegation
- Progress monitoring
- Conflict resolution
- Result synthesis
- Quality assurance

## Workflow
1. **Receive**: Accept task from user
2. **Analyze**: Understand requirements and constraints
3. **Decompose**: Break into subtasks
4. **Delegate**: Assign to appropriate agents
5. **Monitor**: Track progress and handle issues
6. **Synthesize**: Combine agent outputs
7. **Deliver**: Present final result

## Agent Types
- **Planner**: Creates execution plans
- **Researcher**: Gathers information
- **Coder**: Implements solutions
- **Content**: Creates written content
- **Analyst**: Processes data
- **Verifier**: Checks quality
- **Finalizer**: Polishes output

## Delegation Template
```

Task Assignment:
Agent: [agent type]
Task: [specific task]
Context: [relevant background]
Requirements: [acceptance criteria]
Dependencies: [what it needs]
Deliverable: [expected output]
Deadline: [if applicable]

```

## Monitoring Checklist
- [ ] All agents have clear tasks
- [ ] Dependencies are tracked
- [ ] Progress is being made
- [ ] Blockers are addressed
- [ ] Quality standards met
- [ ] Timeline on track

## Best Practices
- Communicate clearly
- Set explicit expectations
- Monitor without micromanaging
- Escalate issues promptly
- Document decisions
```

**الأدوار المستهدفة:** Orchestrator  
**الأولوية:** عالية (أساسية)

---

### 6.2 مهارة Planner

**الوصف:** تخطيط وإنشاء خطط التنفيذ

**SKILL.md المقترح:**

```yaml
---
name: planner-core
description: Create detailed execution plans for complex tasks, including step-by-step workflows, resource allocation, and timeline estimation.
license: Apache-2.0
metadata:
  author: multi-agent-team
  version: "1.0"
  category: planning
allowed-tools: Read Write
---

# Planner Core Skill

## Role
The Planner creates comprehensive execution plans that guide multi-agent teams through complex tasks.

## Responsibilities
- Analyze task requirements
- Create step-by-step plans
- Estimate effort and timeline
- Identify dependencies
- Allocate resources
- Define success criteria

## Planning Process
1. **Understand**: Clarify objectives and constraints
2. **Research**: Gather necessary information
3. **Structure**: Define phases and milestones
4. **Detail**: Create specific steps
5. **Sequence**: Order steps logically
6. **Estimate**: Assess time and resources
7. **Validate**: Check feasibility
8. **Document**: Create plan document

## Plan Components
```

Execution Plan: [task name]

Overview:

- Objective: [what we're achieving]
- Success Criteria: [how we know it's done]
- Constraints: [limitations]

Phases:

1. [Phase Name]
   - Steps: [list]
   - Dependencies: [what's needed]
   - Estimated Time: [duration]
   - Agent: [who does it]

Timeline:

- Start: [date]
- Milestones: [key dates]
- End: [date]

Risks:

- [risk] → [mitigation]

Resources Needed:

- [list]

```

## Planning Best Practices
- Be specific and measurable
- Include buffer time
- Identify critical path
- Plan for contingencies
- Review and adjust

## Estimation Techniques
- **Analogous**: Based on similar past tasks
- **Parametric**: Formula-based
- **Three-Point**: Optimistic/Pessimistic/Most Likely
- **Expert Judgment**: Consult specialists
```

**الأدوار المستهدفة:** Planner, Orchestrator  
**الأولوية:** عالية

---

### 6.3 مهارة Verifier

**الوصف:** التحقق من الجودة والدقة

**SKILL.md المقترح:**

```yaml
---
name: verifier-core
description: Verify quality, accuracy, and completeness of agent outputs. Check against requirements and identify issues for correction.
license: Apache-2.0
metadata:
  author: multi-agent-team
  version: "1.0"
  category: verification
allowed-tools: Read
---

# Verifier Core Skill

## Role
The Verifier ensures all outputs meet quality standards and fulfill requirements before delivery.

## Responsibilities
- Check against requirements
- Verify accuracy
- Assess completeness
- Identify errors
- Provide feedback
- Approve or reject

## Verification Dimensions

### Accuracy
- [ ] Facts are correct
- [ ] Calculations are accurate
- [ ] Logic is sound
- [ ] Sources are credible

### Completeness
- [ ] All requirements addressed
- [ ] No missing sections
- [ ] Edge cases covered
- [ ] Documentation included

### Quality
- [ ] Clear and readable
- [ ] Well-structured
- [ ] Professional tone
- [ ] Consistent formatting

### Compliance
- [ ] Follows guidelines
- [ ] Meets standards
- [ ] Proper citations
- [ ] Legal/ethical compliance

## Verification Report
```

Verification Report: [output name]

Status: [Approved/Needs Revision/Rejected]

Checks Passed: [X/Y]

Issues Found:

- [Severity] [Category]: [description]
  → [suggested fix]

Strengths:

- [what's done well]

Required Changes:

1. [specific change needed]

Approval: [Yes/No - with conditions]

```

## Severity Levels
- **Critical**: Must fix, blocks approval
- **Major**: Should fix, impacts quality
- **Minor**: Nice to fix, cosmetic
- **Info**: Observation, no action needed

## Best Practices
- Be objective and specific
- Provide actionable feedback
- Prioritize issues
- Acknowledge good work
- Follow up on corrections
```

**الأدوار المستهدفة:** Verifier, All Agents (self-check)  
**الأولوية:** عالية

---

### 6.4 مهارة Finalizer

**الوصف:** التلميع النهائي وإعداد التسليم

**SKILL.md المقترح:**

```yaml
---
name: finalizer-core
description: Polish and prepare final deliverables for presentation. Ensure professional formatting, consistency, and readiness for delivery.
license: Apache-2.0
metadata:
  author: multi-agent-team
  version: "1.0"
  category: finalization
allowed-tools: Read Write Edit
---

# Finalizer Core Skill

## Role
The Finalizer prepares outputs for delivery by polishing, formatting, and ensuring professional presentation.

## Responsibilities
- Polish and refine content
- Ensure consistent formatting
- Create executive summary
- Package deliverables
- Final quality check
- Prepare handoff

## Finalization Checklist

### Content
- [ ] All sections complete
- [ ] Executive summary included
- [ ] Key points highlighted
- [ ] Call to action clear

### Formatting
- [ ] Consistent styling
- [ ] Proper headings hierarchy
- [ ] Professional layout
- [ ] Brand compliance

### Technical
- [ ] Links working
- [ ] Images displaying
- [ ] Files properly named
- [ ] Format appropriate

### Documentation
- [ ] Context provided
- [ ] Assumptions documented
- [ ] Sources cited
- [ ] Next steps outlined

## Finalization Process
1. **Review**: Read through complete output
2. **Polish**: Refine language and flow
3. **Format**: Apply consistent styling
4. **Summarize**: Create executive summary
5. **Package**: Organize deliverables
6. **Verify**: Final quality check
7. **Deliver**: Present to user

## Deliverable Package
```

📁 [Project Name]
├── 📄 Executive Summary
├── 📄 Main Deliverable
├── 📁 Supporting Materials
│ ├── [appendices, data, etc.]
├── 📄 README (context and instructions)
└── 📄 Sources/References

```

## Best Practices
- Keep executive summary brief (1 page)
- Ensure standalone readability
- Anticipate questions
- Provide clear next steps
- Make it visually appealing
```

**الأدوار المستهدفة:** Finalizer  
**الأولوية:** عالية

---

## 7. المهارات المشتركة (Shared Skills)

### 7.1 مهارة التواصل بين الوكلاء (inter-agent-communication)

**الوصف:** بروتوكولات التواصل الفعال بين الوكلاء

**SKILL.md المقترح:**

```yaml
---
name: inter-agent-communication
description: Effective communication protocols for multi-agent collaboration including message formats, handoff procedures, and status updates.
license: Apache-2.0
metadata:
  author: multi-agent-team
  version: "1.0"
  category: communication
allowed-tools: Read Write
---

# Inter-Agent Communication Skill

## Purpose
Establish clear, efficient communication protocols for multi-agent collaboration.

## Communication Principles
- **Clear**: Unambiguous messages
- **Concise**: Relevant information only
- **Structured**: Consistent format
- **Timely**: Appropriate updates
- **Actionable**: Include next steps

## Message Types

### Task Assignment
```

📋 TASK ASSIGNMENT
From: [sender]
To: [receiver]
Task: [description]
Context: [background]
Requirements: [acceptance criteria]
Deadline: [when needed]
Priority: [High/Medium/Low]

```

### Status Update
```

📊 STATUS UPDATE
From: [agent]
Task: [what working on]
Status: [In Progress/Blocked/Complete]
Progress: [X% or description]
Blockers: [any issues]
Next: [what's next]
ETA: [estimated completion]

```

### Handoff
```

🔄 HANDOFF
From: [agent A]
To: [agent B]
Task: [description]
Completed: [what's done]
Context: [relevant info]
Next Steps: [what B should do]
Files: [relevant files/locations]

```

### Question/Clarification
```

❓ QUESTION
From: [agent]
To: [agent/orchestrator]
Regarding: [task/topic]
Question: [specific question]
Context: [why asking]
Needed By: [when needed]

```

## Communication Best Practices
- Use structured formats
- Include context
- Be specific about needs
- Respond promptly
- Document decisions
- Keep orchestrator informed
```

**الأدوار المستهدفة:** All Agents  
**الأولوية:** عالية

---

### 7.2 مهارة إدارة السياق (context-management)

**الوصف:** إدارة السياق والحالة عبر الوكلاء

**SKILL.md المقترح:**

```yaml
---
name: context-management
description: Manage shared context and state across agent interactions, ensuring continuity and coherence in multi-agent workflows.
license: Apache-2.0
metadata:
  author: multi-agent-team
  version: "1.0"
  category: coordination
allowed-tools: Read Write
---

# Context Management Skill

## Purpose
Maintain shared understanding and state across multi-agent interactions.

## Context Types

### Task Context
- Original request
- Objectives and goals
- Constraints and requirements
- Success criteria

### Progress Context
- What's been completed
- Current status
- Remaining work
- Blockers and issues

### Knowledge Context
- Research findings
- Decisions made
- Lessons learned
- Best practices identified

## Context Storage
```

📁 Shared Context
├── 📄 task_description.md
├── 📄 requirements.md
├── 📄 decisions.md
├── 📄 progress.md
├── 📁 research/
├── 📁 outputs/
└── 📄 handoff_notes.md

```

## Context Handoff Format
```

CONTEXT HANDOFF

Task Summary:
[brief description]

What's Been Done:

- [completed items]

Current State:
[where things stand]

Key Findings:

- [important discoveries]

Decisions Made:

- [what was decided]

Next Steps:

- [what to do next]

Open Questions:

- [unresolved issues]

Files:

- [location of relevant files]

```

## Best Practices
- Update context regularly
- Keep it organized
- Make it discoverable
- Version important decisions
- Clean up when complete
```

**الأدوار المستهدفة:** All Agents, Orchestrator  
**الأولوية:** عالية

---

### 7.3 مهارة معالجة الأخطاء (error-handling)

**الوصف:** اكتشاف الأخطاء ومعالجتها بشكل مناسب

**SKILL.md المقترح:**

```yaml
---
name: error-handling
description: Detect, diagnose, and handle errors gracefully in multi-agent workflows. Implement recovery strategies and escalation procedures.
license: Apache-2.0
metadata:
  author: multi-agent-team
  version: "1.0"
  category: reliability
allowed-tools: Bash Read Write
---

# Error Handling Skill

## Purpose
Ensure robust operation through effective error detection, handling, and recovery.

## Error Types

### Technical Errors
- Tool failures
- API errors
- File system issues
- Network problems

### Logic Errors
- Incorrect assumptions
- Invalid reasoning
- Missing edge cases
- Wrong approach

### Communication Errors
- Misunderstood requirements
- Incomplete handoffs
- Lost context
- Conflicting information

## Error Handling Process
1. **Detect**: Identify something went wrong
2. **Assess**: Determine severity and impact
3. **Diagnose**: Find root cause
4. **Recover**: Implement fix or workaround
5. **Learn**: Document for future prevention

## Error Severity
- **Critical**: System down, data loss
- **High**: Feature broken, blocked progress
- **Medium**: Workaround available
- **Low**: Minor issue, cosmetic

## Recovery Strategies
- **Retry**: Try operation again
- **Fallback**: Use alternative approach
- **Degrade**: Reduced functionality
- **Escalate**: Get help
- **Abort**: Stop and report

## Error Report Format
```

🚨 ERROR REPORT

Error: [brief description]
Severity: [Critical/High/Medium/Low]

Context:

- Task: [what was being done]
- Agent: [which agent]
- Time: [when occurred]

Details:
[error message/stack trace]

Impact:
[what's affected]

Attempted Recovery:
[what was tried]

Next Steps:
[recommended action]
Escalation: [who to notify]

```

## Best Practices
- Fail gracefully
- Provide clear error messages
- Log for debugging
- Don't expose sensitive info
- Have backup plans
```

**الأدوار المستهدفة:** All Agents, Orchestrator  
**الأولوية:** عالية

---

## 8. خطة التنفيذ المقترحة

### المرحلة 1: المهارات ذات الأولوية العالية (أسبوع 1-2)

| المهارة                   | الغرض          | الأدوار                  |
| ------------------------- | -------------- | ------------------------ |
| orchestrator-core         | تنسيق الفريق   | Orchestrator             |
| planner-core              | تخطيط المهام   | Planner                  |
| verifier-core             | ضمان الجودة    | Verifier                 |
| finalizer-core            | تلميع التسليم  | Finalizer                |
| inter-agent-communication | تواصل فعال     | All Agents               |
| context-management        | إدارة السياق   | All Agents               |
| error-handling            | معالجة الأخطاء | All Agents               |
| code-generation           | كتابة الكود    | Coding Agent             |
| code-review               | مراجعة الكود   | Verifier                 |
| test-generation           | اختبارات       | Coding Agent             |
| debugging                 | إصلاح الأخطاء  | Coding Agent             |
| data-analysis             | تحليل البيانات | Data Analysis Agent      |
| data-visualization        | رسوم بيانية    | Data Analysis Agent      |
| advanced-research         | بحث متقدم      | Research Agent           |
| source-analysis           | تحليل المصادر  | Research Agent           |
| content-writing           | كتابة محتوى    | Content Agent            |
| insight-extraction        | استخراج الرؤى  | Data Analysis Agent      |
| pptx-creation             | عروض تقديمية   | Content Agent, Finalizer |
| xlsx-analysis             | جداول بيانات   | Data Analysis Agent      |
| docx-creation             | مستندات        | All Agents               |
| pdf-processing            | معالجة PDF     | All Agents               |

### المرحلة 2: المهارات ذات الأولوية المتوسطة (أسبوع 3-4)

| المهارة               | الغرض             | الأدوار             |
| --------------------- | ----------------- | ------------------- |
| content-summarization | تلخيص المحتوى     | Research Agent      |
| citation-management   | إدارة الاستشهادات | Research Agent      |
| content-optimization  | تحسين المحتوى     | Content Agent       |
| proofreading          | تدقيق لغوي        | Verifier, Finalizer |

### المرحلة 3: المهارات ذات الأولوية المنخفضة (أسبوع 5+)

| المهارة                    | الغرض       | الأدوار     |
| -------------------------- | ----------- | ----------- |
| [Template-specific skills] | تخصيص إضافي | Specialists |
| [Domain-specific skills]   | خبرات مجال  | Specialists |
| [Integration skills]       | تكامل خارجي | All Agents  |

---

## ملخص التوصيات

### المهارات الأساسية (21 مهارة)

يجب تنفيذها فوراً لتشغيل النظام الأساسي:

1. **أدوار أساسية (4)**: orchestrator-core, planner-core, verifier-core, finalizer-core
2. **تواصل وتنسيق (3)**: inter-agent-communication, context-management, error-handling
3. **Coding (4)**: code-generation, code-review, test-generation, debugging
4. **Research (2)**: advanced-research, source-analysis
5. **Content (1)**: content-writing
6. **Data Analysis (3)**: data-analysis, data-visualization, insight-extraction
7. **مُنشأة مسبقاً (4)**: pptx-creation, xlsx-analysis, docx-creation, pdf-processing

### هيكل المجلدات المقترح

```
skills/
├── core/
│   ├── orchestrator-core/
│   ├── planner-core/
│   ├── verifier-core/
│   └── finalizer-core/
├── shared/
│   ├── inter-agent-communication/
│   ├── context-management/
│   └── error-handling/
├── coding/
│   ├── code-generation/
│   ├── code-review/
│   ├── test-generation/
│   └── debugging/
├── research/
│   ├── advanced-research/
│   ├── source-analysis/
│   ├── content-summarization/
│   └── citation-management/
├── content/
│   ├── content-writing/
│   ├── content-optimization/
│   └── proofreading/
├── data-analysis/
│   ├── data-analysis/
│   ├── data-visualization/
│   └── insight-extraction/
└── prebuilt/
    ├── pptx-creation/
    ├── xlsx-analysis/
    ├── docx-creation/
    └── pdf-processing/
```

---

**ملاحظة:** هذا التحليل يوفر أساساً شاملاً لتنفيذ نظام Agent Skills لتطبيق بناء فرق الوكلاء. يمكن تخصيص المهارات وإضافة مهارات جديدة حسب احتياجات التطبيق المحددة.
