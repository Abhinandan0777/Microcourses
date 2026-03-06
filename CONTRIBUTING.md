# Contributing to MicroCourses

Thank you for your interest in contributing to MicroCourses! This document provides guidelines and information for contributors.

## 🚀 Getting Started

### Prerequisites
- Node.js 18+
- PostgreSQL 14+ (or SQLite for local development)
- Git

### Development Setup

1. **Fork and clone the repository:**
```bash
git clone https://github.com/your-username/microcourses.git
cd microcourses
```

2. **Install dependencies:**
```bash
make install
# or
npm install && cd frontend && npm install && cd ..
```

3. **Setup environment:**
```bash
cp .env.example .env
# Edit .env with your configuration
```

4. **Setup database:**
```bash
make migrate seed
# or
npm run db:migrate && npm run seed
```

5. **Start development servers:**
```bash
make dev
# or
./start.sh
```

## 📋 Development Guidelines

### Code Style

- **Backend:** Follow Node.js best practices
- **Frontend:** Use React functional components with hooks
- **Styling:** Use Tailwind CSS utility classes
- **Linting:** Run `make lint` before committing

### Commit Messages

Use conventional commit format:
```
type(scope): description

feat(auth): add JWT token refresh
fix(api): resolve course enrollment bug
docs(readme): update installation instructions
test(integration): add certificate generation tests
```

Types: `feat`, `fix`, `docs`, `style`, `refactor`, `test`, `chore`

### Branch Naming

- `feature/description` - New features
- `fix/description` - Bug fixes
- `docs/description` - Documentation updates
- `test/description` - Test additions/updates

## 🧪 Testing

### Running Tests

```bash
# All tests
make test

# Watch mode
make test-watch

# Specific test file
npm test -- tests/integration/judge-flow.test.js

# Coverage report
npm run test:coverage
```

### Writing Tests

- Place tests in the `tests/` directory
- Use descriptive test names
- Follow the existing test structure
- Include both positive and negative test cases
- Test error conditions and edge cases

### Test Categories

1. **Unit Tests:** Test individual functions/modules
2. **Integration Tests:** Test API endpoints and flows
3. **E2E Tests:** Test complete user workflows

## 🏗️ Architecture

### Backend Structure

```
src/
├── config/          # Configuration files
├── middleware/      # Express middleware
├── routes/          # API route handlers
└── server.js        # Main server file
```

### Frontend Structure

```
frontend/src/
├── components/      # Reusable React components
├── contexts/        # React context providers
├── pages/           # Main application pages
└── App.js           # Root component
```

### Database

- **Migrations:** Add new migrations in `scripts/migrate.js`
- **Seeding:** Update seed data in `scripts/seed.js`
- **Schema:** Follow existing naming conventions

## 📝 API Guidelines

### Endpoint Design

- Use RESTful conventions
- Include proper HTTP status codes
- Follow existing error response format
- Support pagination where applicable
- Include idempotency for create operations

### Error Handling

All errors should follow this format:
```json
{
  "error": {
    "code": "ERROR_CODE",
    "field": "fieldName",
    "message": "Human readable message"
  }
}
```

### Authentication

- Use JWT tokens with proper expiration
- Implement role-based access control
- Include rate limiting on all endpoints

## 🎨 Frontend Guidelines

### Component Structure

```jsx
import React, { useState, useEffect } from 'react';

const ComponentName = ({ prop1, prop2 }) => {
  const [state, setState] = useState(initialValue);

  useEffect(() => {
    // Side effects
  }, [dependencies]);

  const handleAction = () => {
    // Event handlers
  };

  return (
    <div className="tailwind-classes">
      {/* JSX content */}
    </div>
  );
};

export default ComponentName;
```

### Styling Guidelines

- Use Tailwind CSS utility classes
- Follow mobile-first responsive design
- Maintain consistent spacing and colors
- Use semantic HTML elements

### State Management

- Use React Context for global state
- Keep component state local when possible
- Use custom hooks for reusable logic

## 🔄 Pull Request Process

### Before Submitting

1. **Test your changes:**
```bash
make test
make lint
```

2. **Update documentation:**
- Update README if needed
- Add/update API documentation
- Include inline code comments

3. **Check your changes:**
- Ensure all tests pass
- Verify functionality works as expected
- Test on different screen sizes (frontend)

### PR Template

```markdown
## Description
Brief description of changes

## Type of Change
- [ ] Bug fix
- [ ] New feature
- [ ] Breaking change
- [ ] Documentation update

## Testing
- [ ] Tests pass locally
- [ ] Added new tests for changes
- [ ] Manual testing completed

## Checklist
- [ ] Code follows project style guidelines
- [ ] Self-review completed
- [ ] Documentation updated
- [ ] No breaking changes (or documented)
```

### Review Process

1. **Automated Checks:** CI/CD pipeline runs tests and linting
2. **Code Review:** Maintainers review code quality and design
3. **Testing:** Changes are tested in development environment
4. **Approval:** PR is approved and merged

## 🐛 Bug Reports

### Before Reporting

1. Check existing issues
2. Reproduce the bug
3. Test with latest version

### Bug Report Template

```markdown
**Describe the bug**
Clear description of the bug

**To Reproduce**
Steps to reproduce:
1. Go to '...'
2. Click on '....'
3. See error

**Expected behavior**
What you expected to happen

**Screenshots**
If applicable, add screenshots

**Environment:**
- OS: [e.g. macOS, Windows, Linux]
- Browser: [e.g. Chrome, Firefox, Safari]
- Node.js version: [e.g. 18.17.0]
- Database: [PostgreSQL/SQLite]

**Additional context**
Any other context about the problem
```

## 💡 Feature Requests

### Feature Request Template

```markdown
**Is your feature request related to a problem?**
Clear description of the problem

**Describe the solution you'd like**
Clear description of desired solution

**Describe alternatives you've considered**
Alternative solutions or features considered

**Additional context**
Screenshots, mockups, or examples
```

## 📚 Resources

### Documentation
- [Node.js Documentation](https://nodejs.org/docs/)
- [React Documentation](https://react.dev/)
- [Express.js Guide](https://expressjs.com/)
- [PostgreSQL Documentation](https://www.postgresql.org/docs/)
- [Tailwind CSS](https://tailwindcss.com/docs)

### Tools
- [Postman](https://www.postman.com/) - API testing
- [pgAdmin](https://www.pgadmin.org/) - PostgreSQL management
- [React Developer Tools](https://react.dev/learn/react-developer-tools)

## 🤝 Community

### Getting Help

- **Issues:** Use GitHub issues for bugs and feature requests
- **Discussions:** Use GitHub discussions for questions
- **Documentation:** Check README and inline documentation

### Code of Conduct

- Be respectful and inclusive
- Focus on constructive feedback
- Help others learn and grow
- Follow project guidelines

## 🏆 Recognition

Contributors will be recognized in:
- README contributors section
- Release notes for significant contributions
- Project documentation

Thank you for contributing to MicroCourses! 🎉