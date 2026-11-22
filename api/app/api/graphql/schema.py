"""The GraphQL schema, assembled from one Query/Mutation class per area, with the safety limits."""

from collections.abc import Callable

import strawberry
from strawberry.extensions import (
    DisableIntrospection,
    MaxAliasesLimiter,
    MaxTokensLimiter,
    QueryDepthLimiter,
    SchemaExtension,
)

from app.api.graphql.analytics import AnalyticsQuery
from app.api.graphql.auth import AuthMutation, AuthQuery
from app.api.graphql.conferences import ConferenceMutation, ConferenceQuery
from app.api.graphql.extensions import CsrfProtection
from app.api.graphql.profile import ProfileMutation, ProfileQuery
from app.api.graphql.registrations import RegistrationMutation, RegistrationQuery
from app.api.graphql.stats import PublicMutation, StatsQuery


@strawberry.type
class Query(AnalyticsQuery, ProfileQuery, StatsQuery, RegistrationQuery, ConferenceQuery, AuthQuery):
    pass


@strawberry.type
class Mutation(ProfileMutation, PublicMutation, RegistrationMutation, ConferenceMutation, AuthMutation):
    pass


def build_schema(production: bool) -> strawberry.Schema:
    # Factories, so each request gets fresh extension instances.
    extensions: list[Callable[[], SchemaExtension] | type[SchemaExtension]] = [
        CsrfProtection,
        lambda: QueryDepthLimiter(max_depth=10),
        lambda: MaxTokensLimiter(max_token_count=2000),
        lambda: MaxAliasesLimiter(max_alias_count=15),
    ]
    if production:
        extensions.append(DisableIntrospection)
    return strawberry.Schema(query=Query, mutation=Mutation, extensions=extensions)
