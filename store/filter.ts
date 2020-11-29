import { Module, VuexModule, Mutation, Action } from 'vuex-module-decorators'
import Axios, { AxiosError, AxiosResponse } from 'axios'
import { $apiConfig } from '@/plugins/api-accessor'
import { DefaultApi, UserData, ProjectItem } from '~/api'
import { authStore } from '~/utils/store-accessor'
async function fetchUserImage(id: number): Promise<string> {
  // return await new Promise((resolve) => resolve(id.toFixed()))
  console.log(`fetchUserImage ${id}`)
  const res: AxiosResponse<Blob> | void = await new DefaultApi($apiConfig)
    .apiV2UsersUserIdIconGet(id.toFixed(), {
      responseType: 'blob',
    })
    .catch((err) => console.log(err))
  console.log(res)
  if (!res) throw new Error('no res')
  return new Promise((resolve, reject) => {
    const reader = new FileReader()
    reader.onload = (): void => {
      if (typeof reader.result === 'string') {
        resolve(reader.result)
      } else {
        reject(new TypeError('invalid image type'))
      }
    }
    reader.readAsDataURL(res.data)
  })
}
export interface Project {
  data: ProjectItem
  users: number[]
}

export interface User {
  data: UserData
  image: string
}
@Module({
  name: 'filter',
  stateFactory: true,
  namespaced: true,
  preserveState: false,
})
export default class AuthModule extends VuexModule {
  private projects: Project[] = []
  private users: User[] = []
  private selectedUserId: number[] = []
  private selectedProjectId: number[] = []

  get getProjects(): Project[] {
    return this.projects
  }

  get prjectsIdList(): number[] {
    return this.projects.map((project): number => {
      return project.data.id
    })
  }

  get allUsers(): User[] {
    return this.users
  }

  get getSelectedUserId(): number[] {
    return this.selectedUserId
  }

  get getSelectedProjectId(): number[] {
    return this.selectedProjectId
  }

  get filteredUsers(): User[] {
    return this.users.filter((testUser) =>
      this.selectedUserId.includes(testUser.data.id)
    )
  }

  get filteredProjects(): Project[] {
    return this.projects.filter((testProject) =>
      this.selectedProjectId.includes(testProject.data.id)
    )
  }

  @Mutation
  setProjects(value: Project[]): void {
    this.projects = value
  }

  @Mutation
  setUsers(users: User[]): void {
    this.users = users
  }

  @Mutation
  pushUsers(user: User): void {
    const test = this.users.find((refUser) => refUser.data.id === user.data.id)
    if (!test) this.users.push(user)
  }

  @Mutation
  setSelectedUsers(userIds: number[]): void {
    this.selectedUserId = userIds
  }

  @Mutation
  setSelectedProjects(projectIds: number[]): void {
    this.selectedProjectId = projectIds
  }

  @Action
  async fetchProjects(): Promise<void> {
    const res: AxiosResponse<ProjectItem[]> = await new DefaultApi($apiConfig)
      .apiV2ProjectsGet()
      .catch(async (err: AxiosError) => {
        if (err.response && err.response.status === 401) {
          await authStore.refresh()
          return Axios.request(err.config)
        } else {
          throw err
        }
      })
    const projects: Project[] = []
    await Promise.all(
      res.data.map(
        async (project): Promise<void> => {
          const users = await this.fetchUsers(project.id).catch((err) =>
            console.log(err)
          )
          projects.push({ data: project, users: users || [] })
        }
      )
    )

    this.setProjects(projects)
  }

  @Action
  async addUser(user: UserData): Promise<void> {
    const test = this.allUsers.find((refUser) => refUser.data.id === user.id)
    if (test) return
    const image = await fetchUserImage(user.id).catch((err) => console.log(err))
    this.pushUsers({ data: user, image: image || '' })
  }

  @Action
  async fetchUsers(projectId: number): Promise<number[]> {
    const res: AxiosResponse<UserData[]> = await new DefaultApi($apiConfig)
      .apiV2ProjectsProjectIdOrKeyUsersGet(projectId.toFixed())
      .catch(async (err: AxiosError) => {
        if (err.response && err.response.status === 401) {
          await authStore.refresh()
          return Axios.request(err.config)
        } else {
          throw err
        }
      })
    const users: number[] = []
    await Promise.all(
      res.data.map(
        async (user): Promise<void> => {
          const test = this.allUsers.find(
            (refUser) => refUser.data.id === user.id
          )
          users.push(user.id)
          if (!test) await this.addUser(user)
        }
      )
    )
    return users
  }
}
